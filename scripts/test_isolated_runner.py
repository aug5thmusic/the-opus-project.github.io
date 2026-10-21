"""Fail-closed unit tests plus mandatory-in-CI genuine container acceptance."""
import io
from contextlib import contextmanager
import ipaddress
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
import uuid
from unittest.mock import Mock, patch

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


def verified_network_denial(control, isolated):
    """An unreachable control is unavailable evidence, never an isolation pass."""
    def reachable_control():
        try:
            result = control()
        except (runner.IsolatedRunError, OSError, ValueError) as error:
            raise AssertionError('Network isolation acceptance UNAVAILABLE: the positive control failed.') from error
        if not isinstance(result, dict) or result.get('connected') is not True or result.get('handshake') is not True:
            raise AssertionError('Network isolation acceptance UNAVAILABLE: the positive control could not reach its listener.')
        return result
    before = reachable_control()
    denied = isolated()
    after = reachable_control()
    if not isinstance(denied, dict) or denied.get('connected') is not False or denied.get('handshake') is not False:
        raise AssertionError('The production network-none container reached the controlled listener or returned invalid evidence.')
    return {'before': before, 'isolated': denied, 'after': after}


def _checked_test_docker(runtime, arguments, *, timeout=15, output_limit=65536):
    code, output, error = runner._bounded([*runtime['_docker'], *arguments], env=runtime['_env'],
                                         timeout=timeout, output_limit=output_limit)
    if code:
        raise AssertionError('Controlled network fixture unavailable: '+error.decode('utf-8', 'replace')[-1000:])
    return output


@contextmanager
def _fixed_network_test_container(runtime, network, root, token, target=None):
    """Test-only network control: fixed canaries, no imported input or commands."""
    name = 'opus-network-control-'+uuid.uuid4().hex
    directory = root / name
    directory.mkdir(mode=0o755)
    job = {'name': 'network_listener' if target is None else 'network_probe',
           'networkToken': token, 'timeout': 90 if target is None else 10}
    if target is not None:
        job['networkTarget'] = str(ipaddress.IPv4Address(target))
    (directory / 'job.json').write_text(json.dumps(job), encoding='utf-8')
    (directory / 'job.json').chmod(0o444)
    command = runner._container_create_command(runtime['_docker'], runtime['imageId'],
                                                str(directory), name, 'canary')
    # This is the sole network-enabled override, confined to this test module.
    # Every other production flag, image ID, worker and fixed canary is shared.
    command[command.index('--network') + 1] = network
    created = False
    try:
        code, _, error = runner._bounded(command, env=runtime['_env'])
        if code:
            raise AssertionError('Network control container unavailable: '+error.decode('utf-8', 'replace')[-1000:])
        created = True
        yield name
    finally:
        if created:
            _checked_test_docker(runtime, ['rm', '--force', name])


def controlled_network_acceptance():
    """Disposable internal bridge; no published port or internet dependency."""
    runtime = runner._available_runtime()
    network = 'opus-network-test-'+uuid.uuid4().hex
    token = uuid.uuid4().hex + uuid.uuid4().hex
    created = False
    try:
        _checked_test_docker(runtime, ['network', 'create', '--internal', '--driver', 'bridge', network])
        created = True
        with tempfile.TemporaryDirectory(prefix='opus-network-fixture-') as temp:
            root = Path(temp)
            root.chmod(0o755)
            with _fixed_network_test_container(runtime, network, root, token) as listener:
                _checked_test_docker(runtime, ['start', listener])
                networks = json.loads(_checked_test_docker(runtime, ['inspect', '--format',
                                      '{{json .NetworkSettings.Networks}}', listener]))
                target = str(ipaddress.IPv4Address(networks[network]['IPAddress']))

                def control():
                    with _fixed_network_test_container(runtime, network, root, token, target) as client:
                        raw = _checked_test_docker(runtime, ['start', '--attach', client], timeout=20)
                        state = json.loads(_checked_test_docker(runtime, ['inspect', '--format', '{{json .State}}', client]))
                        if state.get('Running') is not False or state.get('ExitCode') != 0 or state.get('OOMKilled'):
                            raise AssertionError('Network control did not finish successfully.')
                        return runner._outputs(raw, 'canary')[1]['canary']

                def isolated():
                    # The actual production path has no network override.
                    _, receipt = runner._run('canary', {}, {'name': 'network_probe',
                                             'networkTarget': target, 'networkToken': token}, timeout_seconds=10)
                    if receipt['imageId'] != runtime['imageId']:
                        raise AssertionError('The image changed between the control and isolation probes.')
                    return receipt['canary']

                return verified_network_denial(control, isolated)
    finally:
        if created:
            _checked_test_docker(runtime, ['network', 'rm', network])


class FailClosedTests(unittest.TestCase):
    def test_failed_control_cleans_fixture_without_running_isolation_probe(self):
        calls, created, jobs = [], [], []
        runtime = {'imageId': 'sha256:'+'a'*64, '_docker': ['docker'], '_env': {}}
        network_name = None

        def checked(_runtime, arguments, **kwargs):
            nonlocal network_name
            calls.append(arguments)
            if arguments[:2] == ['network', 'create']:
                self.assertIn('--internal', arguments)
                network_name = arguments[-1]
            if arguments[:2] == ['inspect', '--format']:
                if 'NetworkSettings' in arguments[2]:
                    return json.dumps({network_name: {'IPAddress': '172.29.0.2'}}).encode()
                return b'{"Running":false,"ExitCode":0,"OOMKilled":false}'
            if arguments[:2] == ['start', '--attach']:
                return archive({}, 'canary', {'canary': {'connected': False, 'handshake': False}})
            return b''

        def create(arguments, **kwargs):
            created.append(arguments)
            self.assertEqual(arguments[arguments.index('--network')+1], network_name)
            self.assertEqual(arguments[-2:], [runtime['imageId'], 'canary'])
            self.assertNotIn('--publish', arguments)
            mount = arguments[arguments.index('--mount')+1]
            directory = Path(mount.removeprefix('type=bind,source=').removesuffix(',target=/input,readonly'))
            self.assertEqual([file.name for file in directory.iterdir()], ['job.json'])
            jobs.append(json.loads((directory/'job.json').read_text()))
            return 0, b'', b''

        with patch.object(runner, '_available_runtime', return_value=runtime), \
                patch(__name__+'._checked_test_docker', side_effect=checked), \
                patch.object(runner, '_bounded', side_effect=create), patch.object(runner, '_run') as isolated:
            with self.assertRaisesRegex(AssertionError, 'UNAVAILABLE'):
                controlled_network_acceptance()
            isolated.assert_not_called()
        self.assertEqual([job['name'] for job in jobs], ['network_listener', 'network_probe'])
        self.assertEqual(jobs[0]['networkToken'], jobs[1]['networkToken'])
        names = [command[command.index('--name')+1] for command in created]
        for name in names:
            self.assertIn(['rm', '--force', name], calls)
        self.assertEqual(calls[-1], ['network', 'rm', network_name])

    def test_unreachable_or_invalid_positive_control_cannot_pass_isolation(self):
        for result in ({'connected': False, 'handshake': False}, {'connected': True, 'handshake': False}, None):
            control, isolated = Mock(return_value=result), Mock()
            with self.subTest(result=result), self.assertRaisesRegex(AssertionError, 'UNAVAILABLE'):
                verified_network_denial(control, isolated)
            isolated.assert_not_called()
        control, isolated = Mock(side_effect=runner.IsolatedRunError('listener failed')), Mock()
        with self.assertRaisesRegex(AssertionError, 'UNAVAILABLE'):
            verified_network_denial(control, isolated)
        isolated.assert_not_called()

    def test_listener_must_remain_reachable_after_denial(self):
        control = Mock(side_effect=[{'connected': True, 'handshake': True}, {'connected': False, 'handshake': False}])
        isolated = Mock(return_value={'connected': False, 'handshake': False})
        with self.assertRaisesRegex(AssertionError, 'UNAVAILABLE'):
            verified_network_denial(control, isolated)
        isolated.assert_called_once()

    def test_controlled_network_receipt_requires_denial_between_two_live_controls(self):
        control = Mock(return_value={'connected': True, 'handshake': True})
        denied = {'connected': False, 'handshake': False}
        self.assertEqual(verified_network_denial(control, lambda: denied)['isolated'], denied)
        self.assertEqual(control.call_count, 2)
        for invalid in ({'connected': True, 'handshake': False}, {'connected': True, 'handshake': True}, {}):
            with self.subTest(invalid=invalid), self.assertRaisesRegex(AssertionError, 'network-none'):
                verified_network_denial(control, lambda: invalid)

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
        self.assertEqual(create[create.index('--network') + 1], 'none')
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

    def test_host_read_write_environment_and_capability_canaries(self):
        with tempfile.TemporaryDirectory(prefix='opus-unmounted-canary-') as temp:
            outside = Path(temp)/'credential.txt'; outside.write_text('HOST CANARY MUST NOT LEAK')
            with patch.dict(os.environ, {'OPUS_CANARY_SECRET': 'HOST ENV MUST NOT LEAK'}):
                result = runner._canary_for_tests('probe', outside=str(outside))['canary']
            self.assertEqual(outside.read_text(), 'HOST CANARY MUST NOT LEAK')
            self.assertEqual(result['uid'], 65532)
            for key in ('outsideReadable', 'outsideWritable', 'socket'):
                self.assertFalse(result[key], key)
            self.assertIsNone(result['credential'])
            self.assertTrue(result['noNewPrivs'])
            self.assertTrue(result['capsZero'])

    def test_network_denial_has_live_positive_controls_before_and_after(self):
        result = controlled_network_acceptance()
        self.assertTrue(result['before']['handshake'])
        self.assertFalse(result['isolated']['connected'])
        self.assertTrue(result['after']['handshake'])

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
