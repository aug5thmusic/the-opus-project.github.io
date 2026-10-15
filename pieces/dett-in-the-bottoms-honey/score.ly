\version "2.24.3"
\language "nederlands"
% Reconciled visually against the printed Summy edition, PDF pages 10–11.
% Two independent attempts were compared with all 48 bars. Human review pending.
\header {
 title = "Honey"
 subtitle = "Humoresque"
 subsubtitle = "No. 3 from In the Bottoms"
 composer = "R. Nathaniel Dett"
 tagline = ##f
}
#(set-global-staff-size 17)
\paper {
 #(set-paper-size "a4")
 top-margin = 10\mm
 bottom-margin = 10\mm
 page-count = 2
 system-system-spacing.basic-distance = #18
 system-system-spacing.minimum-distance = #14
 system-system-spacing.padding = #1
}
global = { \key f \major \time 2/4 \set tieWaitForNote = ##t }
rh = \absolute {
 \global
 \tempo "Allegretto" 4 = 100
 \set fingeringOrientations = #'(left)
 % Printed p.52, system1: measures1–4.
 f'16(\pp_\markup\italic "capriccioso" g' a' bes' c'' g'~ \afterGrace g'8) { \once \override Flag.stroke-style = #"grace" f'8->(~ } |
 f'16 g' a' bes' c'' g'~ \afterGrace g'8) { \once \override Flag.stroke-style = #"grace" f'8->(~ } |
 f'16 g' a' bes' c''8) g'8-> |
 <f' a' c''>16-> r16 c''16(\mf_\markup\italic "lunga" f''16->\fermata~ f''16 c'' a' bes') | \break
 % System2: measures5–8.
 << { \voiceOne c''8(-> <d' d''>8~ <d' d''>4~ |
    <d' d''>16) f'16(\> g' a' bes' a' f'8) s1*0\! }
 \\ { \voiceTwo s4 a'8\rest a'8( | bes'16) s16*7 } >> \oneVoice |
 f'2~ | f'4 r4 \afterGrace s1*0 { \slurUp \once \override Flag.stroke-style = #"grace" a'8(~ } | \break
 % System3: measures9–12.
 a'16\pp b'! c'' d'' e'' b'~ \afterGrace b'8) { \slurUp \once \override Flag.stroke-style = #"grace" a'8(~ } |
 a'16 b'! c'' d'' e'' b'~ \afterGrace b'8) { \slurUp \once \override Flag.stroke-style = #"grace" a'8(~ } |
 a'16 b'! c'' d'' e''8) b'8-> |
 << { \voiceOne
 <a' c'' e''>16-> r16 e''16(\mf_\markup\italic "lunga" a''16->\fermata~ a''16 e'' c'' d'' | \break
 % System4: measures13–16. Keep voices alive across all phrase boundaries.
 e''8) -. <f' f''>8->~ <f' f''>4(~ |
    <f' f''>16) b'!16( c'' d'' e'' d'' b'8 |
     a'2)~ | a'4 r4 }
 \\ { \voiceTwo s2 | s4 d''8\rest e''8( | d''16) s16*7 | s2 | s2 } >> \oneVoice | \break
 % System5: measures17–21.
 es''8.(^\markup\italic "meno mosso" _\markup\italic "molto espress. rit." d''16 c''8 a''8\( |
 d''8.\) c''16 bes'4) |
 des''8.( c''16 bes'8 g''8\( _\markup\italic "rit. molto rit." |
 c''8\)\fermata_\markup\italic "lusingando" bes'8\fermata a'4)\fermata |
 \slurDown f'16(^\markup\bold "Tempo I" \pp_\markup\italic "a tempo" g' a' bes' c'' g'~ \afterGrace g'8) { \once \override Flag.stroke-style = #"grace" f'8->(~ } | \pageBreak
 % Printed p.53, system1: measures22–26.
 f'16 g' a' bes' c'' g'~ \afterGrace g'8) { \once \override Flag.stroke-style = #"grace" f'8->(~ } |
 f'16 g' a' bes' c''8) g'8-> |
 \slurUp <f' a' c''>16-> r16 c''16(\mf_\markup\italic "lunga" f''16->\fermata~ f''16 c'' a' bes') |
 << { \voiceOne c''8(-> <d' d''>8~ <d' d''>4~ |
    <d' d''>16) f'16( g' a' bes' a' f'8) }
 \\ { \voiceTwo s4 a'8\rest a'8( | bes'16) s16*7 } >> \oneVoice | \break
 % System2: measures27–32.
 f'2~ | \tempo 4=72 f'4 r4 \bar "||" |
 << { \voiceOne a''8(->^\markup\italic "molto meno mosso e parlando" a''8-> a''16-> a''16->~ a''8) } \\
    { \voiceTwo <a' c'' f''>8\f <a' c'' f''>4. } >> |
 << { \voiceOne as''8( f''8~ f''4) } \\
    { \voiceTwo <as' des''>2\mf } >> |
 << { \voiceOne c''8( a''!4) f''8( } \\
    { \voiceTwo a'!8\f <a' c''>4. } >> |
 << { \voiceOne as''2) } \\
    { \voiceTwo <as' des''>2\mf } >> | \break
 % System3: measures33–38.
 << { \voiceOne es''8 es''8[ es''16 es''16~ es''8] } \\
    { \voiceTwo <es' fis'>2\mf_\markup\italic "recitando" } >> |
 << { \voiceOne g''8-. g''4. } \\
    { \voiceTwo <g' c''>2 } >> |
 \oneVoice <des' f' as' des''>8(->\f <f'-1 as'-2 des''-3 f''-5>8)->~
 <f' as' des'' f''>8( <g'-1 des''-4>8)->(_\markup\italic "rit. espress." |
 <es' as' es''-5>2) |
 es''8(^\markup\italic "molto teneramente e cantabile" _\markup\italic "a tempo" es''8 des''16 c''16~ c''8 |
 des''8-. des''4.)-- | \break
 % System4: measures39–43.
 des''4(_\markup\italic "ritenuto" c''8 bes'8 |
 <a'! c''>2) |
 << { \voiceOne g''16( f''16 d''!16 d''16~ d''4) } \\
    { \voiceTwo g'4~\mf_\markup\italic "a tempo" g'4 } >>
 \oneVoice \bar "||"
 \once \override Score.RehearsalMark.self-alignment-X = #CENTER
 \once \override Score.RehearsalMark.break-align-symbols = #'(staff-bar)
 \mark \markup { \musicglyph "scripts.ufermata" } |
 g'''16(_\markup\italic "quasi echo" f'''16 d'''16\pp d'''16~ d'''4) |
 << { \voiceOne g''16( f''16 des''16 des''16~ des''4) } \\
    { \voiceTwo f'4~\mf_\markup\italic "rit. più espress." f'4 } >>
 \oneVoice \bar "||"
 \once \override Score.RehearsalMark.self-alignment-X = #CENTER
 \once \override Score.RehearsalMark.break-align-symbols = #'(staff-bar)
 \once \override Score.RehearsalMark.break-visibility = #end-of-line-visible
 \mark \markup { \musicglyph "scripts.ufermata" } | \break
 % System5: measures44–48.
 g'''16(\pp_\markup\italic \center-column { "quasi echo rit. e" "più espress." }
 f'''16 des'''16 des'''16~ des'''8) r8\fermata^\markup\bold "Allegro con brio" |
 r4\mf r8 f'16[ g'16] |
 a'16( g' a' c''~ c''8) f''16[ g''16] |
 \autoBeamOff a''16([ g'' a'' c'''~] c'''8) <bes e' a'>8\sf |
 <a f'>8\sf r8 f'''8-. r8 \bar "|."
}
lh = \absolute {
 \global \clef bass \set Staff.pedalSustainStyle = #'text
 f,8\sustainOn <c a c'>4
 \set fingeringOrientations = #'(left) <e-4 bes d'>8\sustainOff
 \set fingeringOrientations = #'(up) |
 f,8\sustainOn <c a c'>4 <e bes d'>8\sustainOff |
 f,8\sustainOn <c a c'>4 <e bes d'>8->\sustainOff |
 <f a c'>16->\sustainOn r16\sustainOff r8\fermata r4 |
 r8 bes8~\sustainOn bes8[ fis8] |
 g16\sustainOff r16 r8 <c e bes>4 |
 r16 f,16(-5[ c a-1] c'16-2[ bes16-3] g8-4 |
 f4)-1 e4-2 |
 a,8\sustainOn <a c' e'>4 <gis d' f'>8\sustainOff |
 a,8\sustainOn <a c' e'>4 <gis d' f'>8\sustainOff |
 a,8\sustainOn <a c' e'>4 <gis d' f'>8->\sustainOff |
 <a c' e'>16->\sustainOn r16\sustainOff r8\fermata r4 |
 r8 d'8->~\sustainOn d'8[ c'8] |
 b!16\sustainOff r16 r8 <e gis d'>4 |
 r16 a,16(-5[ e c'-1] e'16-2[ d'16-3] b!8-4 |
 a4)-1 g!4 |
 fis8.\sustainOn <c' es' a'>16~ <c' es' a'>8[ fis,8(\sustainOff] |
 g,8.)\sustainOn <bes d' g'>16~ <bes d' g'>8[ f!8(\sustainOff] |
 e!8.)\sustainOn <bes c' g'>16~ <bes c' g'>8[ c,8(\sustainOff] |
 f,8)\fermata[ <e g des'>8\fermata] <f c'>4\fermata |
 f,8\sustainOn <c a c'>4 <e bes d'!>8\sustainOff |
 f,8\sustainOn <c a c'>4 <e bes d'>8\sustainOff |
 f,8\sustainOn <c a c'>4 <e bes d'>8->\sustainOff |
 <f a c'>16->\sustainOn r16\sustainOff r8\fermata r4 |
 r8 bes8~\sustainOn bes8[ fis8] |
 g16\sustainOff r16 r8 <c e bes>4 |
 r16 f,16(-5[ c a-1] c'16-2[ bes16-3] g8-4 |
 f4)-5 r4 |
 <f, c>8\sustainOn <a c' f'>4. |
 <des' f'>2\sustainOff |
 <f, c>8\sustainOn <a c' f'>4. |
 <des' f'>2\sustainOff |
 <as c'>2\sustainOn |
 <c g es'>2\sustainOff |
 <des, as,>8->\sustainOn <f~ as des'~>4-> <f g des'>8\sustainOff |
 <as, es c'>2\sustainOn s1*0\sustainOff |
 << { \voiceOne ges'2(-1 } \\
    { \voiceTwo r8_\markup\italic "senza Ped."
      \once \override TextScript.outside-staff-priority = ##f
      <a! es'>4_\markup\override #'(baseline-skip . 1.3) \center-column { \finger "2" \finger "5" } <a es'>8 } >> |
 << { \voiceOne f'2)-1 } \\
    { \voiceTwo r8
      \once \override TextScript.outside-staff-priority = ##f
      <bes des'>4_\markup\override #'(baseline-skip . 1.3) \center-column { \finger "2" \finger "3" }
      \once \override TextScript.outside-staff-priority = ##f
      <as des'>8_\markup\override #'(baseline-skip . 1.3) \center-column { \finger "2" \finger "4" } } >> |
 << { \voiceOne e'!2( } \\
    { \voiceTwo r8
      \once \override TextScript.outside-staff-priority = ##f
      <g bes>4_\markup\override #'(baseline-skip . 1.3) \center-column { \finger "2" \finger "3" } <ges bes>8 } >> |
 << { \voiceOne f'2) } \\
    { \voiceTwo r8 <f a>4 <f a>8 } >> |
 \oneVoice <b, f d'!>2\fermata~ |
 <b, f d'>2\fermata |
 <bes, g des'>2\fermata~ |
 <bes, g des'>4\fermata r8\fermata f16\sustainOn[ g16] |
 a!16( g a c'~ c'8) r8 |
 R2 |
 r4 r8 <c, c>8\sustainOn |
 % Separate the printed release and renewed pedal text at the final barline.
 \once \override SustainPedal.stencil = #ly:text-interface::print
 \once \override SustainPedal.text = \markup { \musicglyph "pedal.*" \hspace #0.6 \musicglyph "pedal.Ped" }
 <f, c>8\sustainOff\sustainOn r8 f,,8-. r8\sustainOff
}
\score {
 \new PianoStaff << \new Staff = "RH" \rh \new Staff = "LH" \lh >>
 \layout { \context { \Score \override BarNumber.break-visibility = ##(#f #f #t) } }
}
