"""Fail-closed unit tests plus mandatory-in-CI genuine container acceptance."""
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch

import isolated_runner as runner


def archive(files, operation='compile', extra=None):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode='w') as tar:
        for name, value in {**files, 'result.json': json.dumps({'schema': 1, 'operation': operation, **(extra or {})}).encode()}.items():
            info = tarfile.TarInfo(name)
            if isinstance(value, tarfile.TarInfo):
                tar.addfile(value)
            else:
                info.size = len(value)
                tar.addfile(info, io.BytesIO(value))
    return output.getvalue()


class FailClosedTests(unittest.TestCase):
    def test_windows_host_canary_is_an_absolute_unmounted_linux_reference(self):
        with patch.object(runner, '_run', return_value=({}, {'canary': {}})) as run:
            runner._canary_for_tests('probe', outside=r'C:\Users\Example\host-canary.txt')
            self.assertEqual(run.call_args.args[2]['outside'], '/unmounted-host-canary')
            runner._canary_for_tests('probe', outside='/tmp/exact-linux-host-canary')
            self.assertEqual(run.call_args.args[2]['outside'], '/tmp/exact-linux-host-canary')
        with self.assertRaises(runner.IsolatedRunError):
            runner._canary_for_tests('probe', outside='relative-canary')

    def test_no_docker_never_invokes_another_program(self):
        with patch.object(runner.shutil, 'which', return_value=None), patch.object(runner.subprocess, 'Popen') as launch:
            with self.assertRaises(runner.IsolationUnavailable):
                runner.ensure_available()
            launch.assert_not_called()

    def test_remote_docker_is_rejected_before_connection(self):
        for host in ('tcp://127.0.0.1:2375', 'tcp://example.com:2376', 'ssh://host', 'npipe:////server/pipe/docker'):
            with self.subTest(host=host), patch.dict(os.environ, {'DOCKER_HOST': host}), patch.object(runner.shutil, 'which', return_value='docker'), patch.object(runner, '_bounded') as launch:
                with self.assertRaises(runner.IsolationUnavailable):
                    runner.ensure_available()
                launch.assert_not_called()

    def test_unavailable_or_unsupported_daemon_and_image_never_start_job(self):
        info = {'OSType': 'linux', 'MemoryLimit': True, 'SwapLimit': True, 'PidsLimit': True, 'CpuCfsQuota': True}
        image = {'Id': 'sha256:'+'a'*64, 'Os': 'linux', 'Config': {'User': '65532:65532', 'Entrypoint': ['/usr/bin/python3', '-I', '/opt/opus/worker.py'], 'Labels': {'org.opus.isolated-runtime': '1', 'org.opus.policy-sha256': runner.policy_sha256()}}}
        cases = [[(1, b'', b'no daemon')], [(0, json.dumps({**info, 'MemoryLimit': False}).encode(), b'')],
                 [(0, json.dumps(info).encode(), b''), (1, b'', b'image missing')],
                 [(0, json.dumps(info).encode(), b''), (0, json.dumps([{**image, 'Config': {**image['Config'], 'User': 'root'}}]).encode(), b'')]]
        for responses in cases:
            with self.subTest(responses=responses), patch.object(runner, '_docker', return_value=(['docker', '--host', 'unix:///var/run/docker.sock'], {})), patch.object(runner, '_bounded', side_effect=responses) as launch:
                with self.assertRaises(runner.IsolationUnavailable):
                    runner.ensure_available()
                self.assertFalse(any('start' in call.args[0] or 'pull' in call.args[0] for call in launch.call_args_list))

    def test_output_archive_rejects_paths_links_devices_duplicates_and_unknown_files(self):
        pdf = b'%PDF-1.4\nfixture\n%%EOF'
        for name in ('../score.pdf', '/score.pdf', 'nested/score.pdf', '.git/config', 'script.sh', 'AGENTS.md', '.agents/tool'):
            with self.subTest(name=name), self.assertRaises(runner.IsolatedRunError):
                runner._outputs(archive({name: pdf}), 'compile')
        for kind in (tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.CHRTYPE, tarfile.FIFOTYPE):
            member = tarfile.TarInfo('score.pdf'); member.type = kind; member.linkname = '/etc/passwd'
            with self.subTest(kind=kind), self.assertRaises(runner.IsolatedRunError):
                runner._outputs(archive({'score.pdf': member}), 'compile')
        raw = io.BytesIO()
        with tarfile.open(fileobj=raw, mode='w') as tar:
            for _ in range(2):
                member = tarfile.TarInfo('score.pdf'); member.size = len(pdf); tar.addfile(member, io.BytesIO(pdf))
        with self.assertRaises(runner.IsolatedRunError):
            runner._outputs(raw.getvalue(), 'compile')

    def test_output_limit_is_checked_before_member_read(self):
        output = io.BytesIO()
        with tarfile.open(fileobj=output, mode='w') as tar:
            member = tarfile.TarInfo('score.pdf'); member.size = runner.MAX_OUTPUT + 1
            tar.addfile(member)
        with self.assertRaises(runner.IsolatedRunError):
            runner._outputs(output.getvalue(), 'compile')

    def test_fixed_policy_and_stopped_container_before_output(self):
        calls = []
        def execute(args, **kwargs):
            calls.append(args)
            if 'start' in args:
                return 0, archive({'score.pdf': b'%PDF-1.4\nfixture\n%%EOF'}), b''
            if 'inspect' in args:
                return 0, b'{"Running":false,"ExitCode":0,"OOMKilled":false}', b''
            return 0, b'', b''
        available = {'imageId': 'sha256:'+'a'*64, 'policySha256': runner.policy_sha256(), '_docker': ['docker', '--host', 'unix:///var/run/docker.sock'], '_env': {}}
        with patch.object(runner, '_available_runtime', return_value=available), patch.object(runner, '_bounded', side_effect=execute):
            files, _ = runner._run('compile', {'source.ly': b'{ c1 }'}, {})
        create = calls[0]
        for required in ('--pull=never', '--read-only', 'none', '65532:65532', 'ALL', 'no-new-privileges', '--pids-limit', '--memory', '--memory-swap', '--cpus', '--tmpfs'):
            self.assertIn(required, create)
        mounts = [create[i+1] for i, value in enumerate(create) if value == '--mount']
        self.assertEqual(len(mounts), 1)
        self.assertTrue(mounts[0].endswith('target=/input,readonly'))
        self.assertNotIn('/var/run/docker.sock', mounts[0])
        self.assertEqual(create[-2], 'sha256:'+'a'*64)
        self.assertEqual(create[-1], 'compile')
        self.assertIn('rm', calls[-1])
        self.assertIn('inspect', calls[-2])
        self.assertIn('score.pdf', files)

    def test_running_or_oom_container_never_exports(self):
        available = {'imageId': 'sha256:'+'a'*64, '_docker': ['docker'], '_env': {}}
        for state in ({'Running': True, 'ExitCode': 0}, {'Running': False, 'ExitCode': 0, 'OOMKilled': True}):
            responses = [(0, b'', b''), (0, b'not consumed', b''), (0, json.dumps(state).encode(), b''), (0, b'', b'')]
            with self.subTest(state=state), patch.object(runner, '_available_runtime', return_value=available.copy()), patch.object(runner, '_bounded', side_effect=responses), patch.object(runner, '_outputs') as export:
                with self.assertRaises(runner.IsolatedRunError):
                    runner._run('compile', {'source.ly': b'{ c1 }'}, {})
                export.assert_not_called()

    def test_unsafe_input_and_unavailable_runtime_do_not_write_output(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); source = root/'source.ly'; pdf = root/'score.pdf'
            source.write_text('{ c1 }')
            with patch.object(runner, '_available_runtime', side_effect=runner.IsolationUnavailable('unavailable')):
                with self.assertRaises(runner.IsolationUnavailable):
                    runner.compile_lilypond(source, pdf)
            self.assertFalse(pdf.exists())
            try:
                (root/'linked.ly').symlink_to(source)
            except OSError:
                return
            with self.assertRaises(runner.IsolatedRunError):
                runner.compile_lilypond(root/'linked.ly', pdf)


class RealContainerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            cls.runtime = runner.ensure_available()
        except runner.IsolationUnavailable as error:
            if os.environ.get('OPUS_REQUIRE_ISOLATION') == '1':
                raise AssertionError('CI requires genuine isolated runtime tests: '+str(error)) from error
            raise unittest.SkipTest('Actual container tests NOT RUN: '+str(error))

    def test_host_read_write_environment_network_and_capability_canaries(self):
        with tempfile.TemporaryDirectory(prefix='opus-unmounted-canary-') as temp:
            outside = Path(temp)/'credential.txt'; outside.write_text('HOST CANARY MUST NOT LEAK')
            with patch.dict(os.environ, {'OPUS_CANARY_SECRET': 'HOST ENV MUST NOT LEAK'}):
                result = runner._canary_for_tests('probe', outside=str(outside))['canary']
            self.assertEqual(outside.read_text(), 'HOST CANARY MUST NOT LEAK')
            self.assertEqual(result['uid'], 65532)
            for key in ('outsideReadable', 'outsideWritable', 'network', 'socket'):
                self.assertFalse(result[key], key)
            self.assertIsNone(result['credential'])
            self.assertTrue(result['noNewPrivs'])
            self.assertTrue(result['capsZero'])

    def test_wall_cpu_memory_pid_output_and_link_limits(self):
        for name in ('timeout', 'cpu', 'memory', 'output', 'symlink'):
            with self.subTest(name=name), self.assertRaises(runner.IsolatedRunError):
                runner._canary_for_tests(name, timeout_seconds=2)
        self.assertTrue(runner._canary_for_tests('pids')['canary']['bounded'])

    def test_real_lilypond_scheme_subprocess_and_built_in_include_are_confined(self):
        with tempfile.TemporaryDirectory(prefix='opus-real-compiler-') as temp:
            root = Path(temp); source = root/'input.ly'; output = root/'result.pdf'; pages = root/'pages'; pages.mkdir()
            outside = root/'host-only.ily'; outside.write_text('HOST-ONLY-CANARY')
            source.write_text('\\version "2.24.3"\n\\include "english.ly"\n'
                              '#(if (file-exists? '+json.dumps(str(outside))+') (error "host canary leaked"))\n'
                              '#(if (getenv "OPUS_CANARY_SECRET") (error "credential leaked"))\n'
                              '#(if (= 0 (system "touch /input/forbidden")) (error "input writable"))\n'
                              '#(system "touch /work/subprocess-stays-inside")\n{ c\'1 }\n')
            with patch.dict(os.environ, {'OPUS_CANARY_SECRET': 'SECRET'}):
                result = runner.compile_lilypond(source, output)
            self.assertIn('LilyPond', result['compiler'])
            self.assertFalse((root/'subprocess-stays-inside').exists())
            self.assertEqual(outside.read_text(), 'HOST-ONLY-CANARY')
            rendered = runner.render_pdf_pages(output, pages)
            self.assertEqual(rendered['pageCount'], 1)
            self.assertEqual(len(rendered['files']), 1)
            source.write_text('\\version "2.24.3"\n\\include '+json.dumps(str(outside))+'\n{ c\'1 }\n')
            with self.assertRaises(runner.IsolatedRunError):
                runner.compile_lilypond(source, root/'refused.pdf')

    def test_compiler_cannot_export_a_script_or_link(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for expression in ('#(symlink "/etc/passwd" "/work/output/score.midi")',
                               '#(call-with-output-file "/work/output/attacker.sh" (lambda (port) (display "evil" port)))'):
                source = root/'source.ly'; source.write_text('\\version "2.24.3"\n'+expression+'\n{ c\'1 }\n')
                with self.assertRaises(runner.IsolatedRunError):
                    runner.compile_lilypond(source, root/'score.pdf')
                self.assertFalse((root/'score.pdf').exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
