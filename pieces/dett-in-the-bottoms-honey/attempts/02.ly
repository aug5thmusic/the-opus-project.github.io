\version "2.24.3"
\pointAndClickOff
#(set-global-staff-size 17)
\header {
  title = "HONEY"
  subtitle = "Humoresque"
  composer = "R. Nathaniel Dett"
  opus = "In the Bottoms, No. 3"
  copyright = "1913 · Clayton F. Summy Co. · Plate C.F.S.Co. 1465"
  tagline = ##f
}
\paper {
  #(set-paper-size "a4")
  top-margin = 10\mm bottom-margin = 10\mm
  left-margin = 12\mm right-margin = 12\mm
  ragged-last-bottom = ##t
}
global = { \key f \major \time 2/4 }
right = \absolute {
  \global \voiceOne \set tieWaitForNote = ##t
  \tempo "Allegretto" 4 = 100
  % Printed page 52, system 1: bars 1–4.
  f'16([ g' a' bes'] c''16[ g'~] \afterGrace g'8) { \once \override Flag.stroke-style = #"grace" f'8->~ } |
  f'16([ g' a' bes'] c''16[ g'~] \afterGrace g'8) { \once \override Flag.stroke-style = #"grace" f'8->~ } |
  f'16( g' a' bes' c''8) g'8-> |
  <f' a' c''>16-> r16 c''16( f''16~->^\fermata f''16[ c'' a' bes']) | \break
  % System 2: bars 5–8.
  c''8(-> d''8~ d''4~ | d''16)[ g'16( a' bes'] c''16[ bes'] g'8) |
  f'2~ | f'4 r4 \slashedGrace { \once \override Flag.stroke-style = #"grace" a'8~ } | \break
  % System 3: bars 9–12.
  a'16([ b'! c'' d''] e''16[ b'~] \afterGrace b'8) { \once \override Flag.stroke-style = #"grace" a'8~ } |
  a'16([ b'! c'' d''] e''16[ b'~] \afterGrace b'8) { \once \override Flag.stroke-style = #"grace" a'8~ } |
  a'16( b'! c'' d'' e''8)-> b'8-> |
  <a' c'' e''>16-> r16 e''16( a''16~->^\fermata a''16[ e'' c'' d'']) | \break
  % System 4: bars 13–16.
  e''8-. f''8(->~ f''4~ | f''16)[ b'!16( c'' d''] e''16[ d''] b'8 |
  b'2)~ | b'4 r4 | \break
  % System 5: bars 17–21.
  \tempo "meno mosso"
  ees''8.( d''16 c''8 a''8\( | d''8.\) c''16 bes'4) |
  ees''8.( d''16 c''8 a''8\( | c''8\)^\fermata bes'8^\fermata a'4)^\fermata |
  \tempo "Tempo I"
  f'16([ g' a' bes'] c''16[ g'~] \afterGrace g'8) { \once \override Flag.stroke-style = #"grace" f'8->~ } | \pageBreak
  % Printed page 53, system 1: bars 22–26.
  f'16([ g' a' bes'] c''16[ g'~] \afterGrace g'8) { \once \override Flag.stroke-style = #"grace" f'8->~ } |
  f'16( g' a' bes' c''8) g'8-> |
  <f' a' c''>16-> r16 c''16( f''16~->^\fermata f''16[ c'' a' bes']) |
  c''8(-> d''8~ d''4~ | d''16)[ g'16( a' bes'] c''16[ bes'] g'8) | \break
  % System 2: bars 27–32.
  f'2~ | \tempo 4 = 72 f'4 r4 \bar "||" |
  a''8(^\markup\bold\italic "molto meno mosso e parlando" -> a''8-> a''16->~ a''16-> a''8) |
  aes''8( f''8~ f''4) |
  c''8( b''!4) g''8( | aes''2) | \break
  % System 3: bars 33–38.
  ees''8 ees''8[ ees''16~ ees''16 ees''8] |
  g''8-. g''4. |
  <des' f' aes' des''>8(-> <f'-1 aes'-2 des''-3 f''-5>8)->~
  <f' aes' des'' f''>8( <g'-1 des''-4>8)-> |
  <ees' aes' ees''-5>2 |
  ees''8(^\markup\bold\italic "molto teneramente e cantabile" ees''8 des''16 c''16~ c''8 |
  des''8-. des''4.--) | \break
  % System 4: bars 39–43.
  des''4( c''8 bes' | <a'! c''>2) |
  g''16( f'' e''! e''~ e''4) \bar "||" |
  g'''16( f''' d''' d'''~ d'''4) |
  g''16( f'' des'' des''~ des''4) \bar "||" | \break
  % System 5: bars 44–48.
  g'''16( f''' des''' des'''~ des'''8) r8^\fermata |
  \tempo "Allegro con brio" r4 r8 f'16[ g'] |
  a'16( g' a' c''~ c''8) f''16[ g''] |
  \autoBeamOff a''16([ g'' a'' c'''~] c'''8) <bes e' a'>8 |
  <a f'>8 r8 f'''8-. r8 \bar "|."
}
innerRight = \absolute {
  \global \voiceTwo
  % 1–4
  s2*4 |
  % 5–6
  s8 d'8~ d'8 a'8( | <d' bes'>16) s16*7 |
  % 7–12
  s2*6 |
  % 13–14
  s8 f'8~ f'8 e''8( | <f' d''>16) s16*7 |
  % 15–24
  s2*10 |
  % 25–26
  s8 d'8~ d'8 a'8( | <d' bes'>16) s16*7 |
  % 27–28
  s2*2 |
  % 29–32
  <a' c'' f''>8 <a' c'' f''>4. | <aes' des''>2 |
  b'!8 <b' d''>4. | <aes' des''>2 |
  % 33–36
  <ees' fis'>2 | <g' bes'>2 | s2*2 |
  % 37–40
  s2*4 |
  % 41–43
  g'4~ g'4 | s2 | f'4~ f'4 |
  % 44–48
  s2*5 |
}

left = \absolute {
  \global \clef bass
  f,8 <c f a>4 <e g bes>8-4 |
  f,8 <c f a>4 <e g bes>8 |
  f,8 <c f a>4 <e g bes>8-> |
  <f a c'>16-> r16 r8^\fermata r4 |
  r8 a8~ a8[ fis8] | g16 r16 r8 <c e bes>4 |
  r16 f,16(-5 c16 a16-1 c'16-2 bes16-3 g8-4 |
  f4)-1 e4-2 |
  a,8 <a c' e'>4 <gis d' f'>8 |
  a,8 <a c' e'>4 <gis d' f'>8 |
  a,8 <a c' e'>4 <gis d' f'>8-> |
  <a c' e'>16-> r16 r8^\fermata r4 |
  r8 d'8->~ d'8[ c'8] | b!16 r16 r8 <e gis d'>4 |
  r16 a,16(-5 e16 b16-1 d'16-2 c'16-3 a!8-4 |
  a4)-1 g!4 |
  fis8.[ <c' ees' a'>16~] <c' ees' a'>8[ cis,8(] |
  g,8.)[ <bes d' g'>16~] <bes d' g'>8[ f!8(] |
  e!8.)[ <bes c' g'>16~] <bes c' g'>8[ c,8(] |
  f,8)^\fermata[ <e g des'>8]^\fermata <f bes>4^\fermata |
  f,8 <c f a>4 <e g b!>8 |
  f,8 <c f a>4 <e g bes>8 |
  f,8 <c f a>4 <e g bes>8-> |
  <f a c'>16-> r16 r8^\fermata r4 |
  r8 a8~ a8[ fis8] | g16 r16 r8 <c e bes>4 |
  r16 f,16(-5 c16 a16-1 c'16-2 bes16-3 g8-4 | f4)-5 r4 |
  <f, c>8 <a c' f'>4. |
  <des' f'>2 |
  <f, c>8 <a c' f'>4. |
  <des' f'>2 |
  <aes c'>2 | <c f ees'>2 |
  <des, aes,>8-> <f~ aes des'~>4(-> <f g des'>8) |
  <aes, ees c'>2 |
  << { ges'2(-1 | f'2)-1 | e'!2( | f'2) } \\
     { r8 <a des'>4_\markup\center-column { \finger "2" \finger "5" } <a des'>8 |
       r8 <bes des'>4_\markup\center-column { \finger "2" \finger "3" } <aes des'>8_\markup\center-column { \finger "2" \finger "4" } |
       r8 <g bes>4_\markup\center-column { \finger "2" \finger "3" } <ges bes>8 |
       r8 <f a>4 <f a>8 } >> |
  <b, f d'>2~^\fermata | <b, f d'>2^\fermata |
  <bes, g des'>2~^\fermata |
  <bes, g des'>4^\fermata r8^\fermata g16[ a16] |
  b!16( a b d'~ d'8) r8 |
  R2 |
  r4 r8 <c, c>8 |
  <f, c>8 r8 f,,8-. r8 |
}
dynamics = {
  s2\pp_\markup\bold\italic "capriccioso" | s2*2 |
  s8 s4.\mf_\markup\bold\italic "lunga" |
  s2 | s16 s16\> s4. | s2\! | s2 |
  s2\pp | s2*2 | s8 s4.\mf_\markup\bold\italic "lunga" |
  s2*4 |
  s2_\markup\bold\italic "molto espress. rit." |
  s2 | s4 s4_\markup\bold\italic "rit. molto rit." |
  s2_\markup\bold\italic "lusingando" |
  s2\pp_\markup\bold\italic "a tempo" |
  s2*2 | s8 s4.\mf_\markup\bold\italic "lunga" |
  s2 | s16 s16\> s4. | s2\! | s2 |
  s2\f | s2\mf | s2\f | s2\mf |
  s2\mf_\markup\bold\italic "recitando" | s2 |
  s4\f s4_\markup\bold\italic "rit. espress." | s2 |
  s2_\markup\bold\italic "a tempo" | s2 |
  s2_\markup\bold\italic "ritenuto" | s2 |
  s2\mf_\markup\bold\italic "a tempo" |
  s2\pp_\markup\bold\italic "quasi echo" |
  s2\mf_\markup\bold\italic "rit. più espress." |
  s2\pp_\markup\bold\italic\column { "quasi echo rit. e" "più espress." } |
  s2\mf | s2 | s4. s8\sf | s8\sf s4. |
}
pedals = {
  s4.\sustainOn s8\sustainOff |
  s4.\sustainOn s8\sustainOff |
  s4.\sustainOn s8\sustainOff |
  s16\sustainOn s16\sustainOff s4. |
  s8 s4.\sustainOn | s2\sustainOff | s2*2 |
  s4.\sustainOn s8\sustainOff |
  s4.\sustainOn s8\sustainOff |
  s4.\sustainOn s8\sustainOff |
  s16\sustainOn s16\sustainOff s4. |
  s8 s4.\sustainOn | s2\sustainOff | s2*2 |
  s4.\sustainOn s8\sustainOff |
  s4.\sustainOn s8\sustainOff |
  s4.\sustainOn s8\sustainOff | s2 |
  s4.\sustainOn s8\sustainOff |
  s4.\sustainOn s8\sustainOff |
  s4.\sustainOn s8\sustainOff |
  s16\sustainOn s16\sustainOff s4. |
  s8 s4.\sustainOn | s2\sustainOff | s2*2 |
  s2\sustainOn | s2\sustainOff | s2\sustainOn | s2\sustainOff |
  s2\sustainOn | s2\sustainOff |
  s4.\sustainOn s8\sustainOff | s4\sustainOn s4\sustainOff |
  s2_\markup { \bold\italic "senza" \musicglyph "pedal.Ped" } | s2*6 |
  s4. s8\sustainOn | s2 | s2 | s4. s16\sustainOn s16\sustainOff |
  s4.\sustainOn s8\sustainOff |
}
\score {
  \new PianoStaff <<
    \new Staff = "right" << \mergeDifferentlyHeadedOn \mergeDifferentlyDottedOn \new Voice \right \new Voice \innerRight >>
    \new Dynamics \dynamics
    \new Staff = "left" \left
    \new Dynamics \pedals
  >>
  \layout { \context { \Score \override SpacingSpanner.shortest-duration-space = #1.5 } }
}
