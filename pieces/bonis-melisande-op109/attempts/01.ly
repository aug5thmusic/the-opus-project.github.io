\version "2.24.3"
\pointAndClickOff
#(set-global-staff-size 16)
\header {
  title = "MÉLISANDE"
  subtitle = \markup \center-column { "Cinq Pièces pour Piano" "Nº 4" }
  dedication = "À Monsieur PAUL LOCARD"
  composer = "MEL–BONIS"
  opus = "Op. 109"
  copyright = "Paris : Alphonse Leduc, 1925 · A.L. 16,935"
  tagline = ##f
}
\paper { #(set-paper-size "a4")
  top-margin = 10\mm bottom-margin = 10\mm
  left-margin = 12\mm right-margin = 12\mm
  ragged-last-bottom = ##t
}
global = { \key des \major \time 2/4 }
up = { \change Staff = "upper" \voiceTwo }
down = { \change Staff = "lower" \voiceOne }

melody = \absolute {
  \global \voiceOne
  \tempo "Andantino" 4 = 52
  bes'2( | ces''4 f''4) | bes'2( | \break
  ces''4 f''4) | ges''8( ^\markup\italic "espress." bes''4-> ges''8 |
  ees''8 c'' bes' aes' | ges'4.)( f'8 | \break
  ges'8 aes'4 ges'8) | aes'4 <f'' aes''>8^\markup\italic "m.g." s8 |
  s4 <ges'' aes''>8 s8 |
  bes'8( des''4 a'8) | \break
  bes'8( des''4 a'8) | s2 |
  des'''4( f'''8 ges''' | ees''' des''' ees''' f''' | \break
  ees''' des''' ees''' f''' | s2) |
  s8 ees'4(^\markup\italic "espress." des'8) | r8 aes'8(^\markup\italic "m.g." bes' f'!8)^\markup\italic "m.d." | \pageBreak
  % Printed page 2, systems 1–6.
  s8 ees'4(^\markup\italic "espress." des'8) | r8 bes'8(^\markup\italic \column { "m.g." "espress." } ces'' g'!8)^\markup\italic "m.d." |
  ges'8( f' ees' d'! | \break
  ees'8\< ges' aes' bes'\!)( | ces''8 bes' aes' g'! | aes' bes' ces'' des'') | \break
  ees''8( ges''4 d''!8 | ees''8 ges''4 d''!8) |
  des''8( ees'') bes'( c'') | \break
  g'!8(^\markup\bold "cédez" aes' g' aes')\< |
  \tempo "a Tempo" a'!2(\! | bes'4 f''4) | \break
  a'!2(^\markup\italic "animato" | bes'4 f''4) |
  ges''8(^\markup\italic "appassionato" bes''4 ges''8 | \break
  ges''8 ees'' c'' bes') |
  beses'4.(^\markup\italic "calmato" aes'8 | beses'4. aes'8 | \pageBreak
  beses'4^\markup\bold "rit." aes'8 ges'8) |
  \tempo "a Tempo" r8 <f' aes' c''>8(^\markup\italic "m.g." <bes' ees''> <f' aes' c''> |
  <bes' ees''>8 <f' aes' c''> <bes' ees''> <f' aes' c''>) | \break
  <des' ges' bes'>8_\markup\italic "stretto" r8 <bes ees' ges'>8 r8 | s2 |
  \tempo "a Tempo" s2 | \break
  s2^\markup\italic "poco rubato" |
  % The print has three eighth-note chord/rest pairs in this bar.
  \omit Staff.TimeSignature \time 3/4
  s2.^\markup\bold "Stretto" |
  \time 2/4
  s2 | \break s2 | s2 | s2 | \break
  % Lento bar is printed without an additional barline or time change.
  \time 4/4
  \tempo "Lento" s4 <bes c'>4~ <bes c'>8[ <bes des'>] aes'4~ |
  \time 2/4
  aes'8[ <c' f' aes' c''> <ees' f' aes' ees''> <f' bes' des'' f''>] |
  aes''4 s8 aes''8~ | aes''8 s4. | aes''8 s4. | \break
  s2*3 |
  <bes des' ges' bes'>2\< | <bes ges' bes' des''>2~\!_\markup\italic "rall. e dim." |
  \time 9/16
  <bes ges' bes' des''>4 s16 <f'' aes''>4^\fermata^\markup\italic "m.g." \bar "|."
}

lowerMelody = \absolute {
  \global \clef bass \voiceTwo
  s2*4 |
  s8 des'4 des'8 | s2*2 |
  s8 d8( e4) | ees4-2 s4 | ees4-> s4 |
  \clef treble ees'8( f' ees' d' | ees' f' ees' d' | ees'! f' ees' des' |
  ces'4)( bes4 | a!4 aes4 | g4) s4 |
  bes'''8^\markup\italic "croisez" r8 s4 |
  \clef bass <ges,, ges,>2 |
  <d, a, d>4 r4 |
  <ges,, ges,>2 | <ees, bes, ees>4 r4 |
  <bes,, bes,>8( \clef treble d''!8-! ees''8-! ges''8-! |
  aes''8-. r8 \clef bass <eeses, eeses>4~ |
  <eeses, eeses>8 \clef treble g''!8-! aes''8-! ces'''8-! |
  ees'''8 r8 \clef bass <ces, ces>4~ |
  <ces, ces>8) \clef treble ges'8( f' d'! |
  ges'8 aes' ges' fes' | f'8) r8 \clef bass g8 r8 |
  d!4~ <d, d>4~ | <d, d>8 gis4~ gis8 |
  s8 des'4( bes8) |
  s8 gis4~ gis8 | s8 des'4( bes8) |
  s8 ges'4( f'8 | ees'8) s4. | s2*2 |
  s2 | <des, aes, des>4 r4 | s2 |
  s2 | <ges beses des'>8 r8 <aes, ees ges>8 r8 |
  <des, bes, des>8 <des' f'>8( <bes bes'> <des' f'> |
  <bes bes'>8 <des' f'> <bes bes'> <des' f'>) |
  \omit Staff.TimeSignature <des ges bes>8 r8 <ges bes des' f'>8 r8 \clef treble <c' ees' ges' bes'>8 r8 |
  c''2-> | c''2-> | c''2-> | c''8 s4. |
  \clef bass \ottava #-1 c,,8 \ottava #0 r8
  <aes,, aes, ees ges aes>4~ <aes, ees ges aes>8[ aes8] <aes, aes f>4 |
  <aes, aes>4 <ees aes>4 |
  aes4 \clef treble des'4~ | des'4 des'4~ | des'8 ges'4-1 ees'8-4~ |
  \clef bass <ges bes ees'>8[ <f aes>8-2 <ges, des ges> <aes, ees>] |
  <des, aes, ees>8[ <f, c f> <ges, des ges> <des aes>] |
  <des, aes, ees>8[ <f, c f> <ges, des ges> <des aes>] |
  ges,2~ | ges,4. f,8( | ees,8 des,4.)( s16) |
}

arpeggios = \absolute {
  \global \voiceTwo
  % Printed page 1, system 1: measures 1–3.
  bes'32[ ges' ees' c'] \down bes[ ges ees aes,] ees[ aes, ees ges] bes \up c'[ ees' ges'] |
  ces''32[ aes' f' ces'] \down beses[ ges eses aes,] eses[ aes, eses ges] beses \up ces'[ f' aes'] |
  bes'32[ ges' ees' d'!] \down bes[ ges ees aes,] ees[ aes, ees ges] bes \up d'[ ees' ges'] |
  % System 2: measures 4–7.
  ces''32[ aes' f' ces'] \down beses[ ges eses aes,] eses[ aes, eses ges] beses \up ces'[ f' aes'] |
  ges''32[ ees'' bes' ges'] \down des'[ ges ees aes,] ees[ aes, ees ges] des' \up ges'[ bes' ees''] |
  ees''32[ bes' ges' ees'] \down aes[ ges ees aes,] d![ aes, d f] aes \up ces'[ d'! f'] |
  ges'32[ ees' bes ges] \down ees[ bes, ges, ees,] bes,[ ees, bes, ees] ges \up b[ c' ees'] |
  % System 3: measures 8–11.
  ges'32[ d'! ces' ges] \down d![ a,! eis, a,] \up ges[ ces' ees' ges'] ges'[ ees' ces' ges] |
  \down ees32[ bes, ees ges] \up c'[ f' aes' c''] f''[ c'' aes' f'] c' \down bes[ ges bes,] |
  ees32[ bes, ees ges] aes \up c'[ ges' aes'] ges''[ aes' ges' c'] \down aes[ ges ees aes,] \up |
  bes'32[ ges' des' ges'] ges'[ ges' des' ges'] r32 ges'[ des' ges'] a'![ ges' des' ges'] |
  % System 4: measures 12–15.
  bes'32[ ges' des' ges'] ges'[ ges' des' ges'] r32 ges'[ des' ges'] a'![ ges' des' ges'] |
  r32 ges'[ bes' ges'] r32 ges'[ bes' des''] r32 bes'[ des'' ges''] r32 des''[ ges'' bes''] |
  \down ces'32[ des' f' aes'] ces'' \up des''[ f'' aes''] \down bes[ des' f' aes'] bes' \up f''[ bes'' des'''] |
  \down a!32[ ces' des' f'] a'! \up des''[ f'' a''!] \down aes[ ces' des' f'] aes' \up f''[ des''' ees'''] |
  % System 5: measures 16–19.
  \down g!32[ des' f' bes'] \up des'''[ f'' bes'' des'''] ees'''[ f'' bes'' des'''] f'''[ f'' c''' ees'''] |
  r32 f''[ bes'' des'''] f'''[ des''' bes'' f''] des'' \down bes'[ f' des'] bes[ \clef bass ges^\markup\italic "m.d." des bes,] \up |
  \down r32 des[ ges bes] \up ees'32[ \down bes ges des] ges[ des ges bes] \up des'32[ \down bes ges des] \up |
  r32 fis[ c' d'!] r32 d'[ c' fis] r32 fis[ c' d'] f'![ d' c' fis] |
  % Printed page 2, system 1: measures 20–22.
  \down r32 des[ ges bes] \up ees'32[ \down bes ges des] ges[ des ges bes] \up des'32[ \down bes ges des] \up |
  r32 g![ des' ees'] r32 ees'[ des' g] r32 g[ des' ees'] g'![ ees' des' g] |
  ges'32[ ees' bes ees'] f'[ ees' bes ees'] ees'[ ees' bes ees'] d'![ ees' bes ees'] |
  % System 2: measures 23–25.
  ees'32[ c' ges c'] ges'[ ees' c' ees'] aes'[ ges' c' ges'] bes'[ ges' c' ges'] |
  ces''32[ ges' ces' ges'] bes'[ ges' des' ges'] aes'[ ges' des' ges'] g'![ ges' des' ges'] |
  aes'32[ f' ces' f'] bes'[ aes' f' aes'] ces''[ aes' f' aes'] des''[ bes' f' bes'] |
  % System 3: measures 26–28.
  ees''32[ ces'' ges' ces''] ces''[ ces'' ges' ces''] r32 ces''[ ges' ces''] d''![ ces'' ges' ces''] |
  ees''32[ ces'' ges' ces''] ces''[ ces'' ges' ces''] r32 ces''[ ges' ces''] d''![ ces'' aes' ces''] |
  des''32[ ces'' aes' ces''] ees''[ ces'' aes' ces''] bes'[ fes' des' fes'] c''[ fes' des' fes'] |
  % System 4: measures 29–31.
  g'!32[ f'! ces' f'] aes'[ f' ces' f'] g'[ f' ces' f'] aes'[ f' ces' f'] |
  a'!32[ fis' c' a!] \down gis[ c a,! e,!] a,[ e, a, c] gis \up a[ c' fis'] |
  bes'32[ ges' ees' des'] \down des'[ ges ees aes,] ees[ aes, ees ges] bes \up des'[ ees' ges'] |
  % System 5: measures 32–34.
  a'!32[ fis' c' a!] \down gis[ c a,! e,!] a,[ e, a, c] gis \up a[ c' fis'] |
  bes'32[ ges' ees' des'] \down des'[ ges ees aes,] ees[ aes, ees ges] bes \up des'[ ees' ges'] |
  ges''32[ d''! c'' aes'] \down ges'[ d'! c' aes] c'[ aes c' d'] f' \up aes'[ c'' ees''] |
  % System 6: measures 35–37.
  ges''32[ c'' aes' ges'] ees''32[ \down c' aes ges] ees[ c ees ges] aes[ c' \up ees' ges'] |
  beses'32[ ges' d'! c'] \down aes[ ges d c] aes,[ c d ges] aes \up ges'[ d' c'] |
  beses'32[ ges' d'! c'] \down aes[ ges d c] aes,[ c d ges] aes \up ges'[ d' c'] |
  % Printed page 3, system 1: measures 38–40.
  beses'32[ ges' d'! c'] \down aes[ ges d c] aes,[ c d ges] aes \up c'[ des' c'] |
  \down des32[ f aes \up des'] f'[ des' \down aes f] r32 f[ aes \up des'] f'[ des' \down aes f] \up |
  \down r32 f[ aes \up des'] f'[ des' \down aes f] r32 f[ aes \up des'] f'[ des' \down aes f] \up |
  % System 2: measures 41–43.
  r32 f''[ bes'' des'''] f'''[ des''' bes'' f''] r32 des''[ ges'' bes''] des'''[ bes'' ges'' des''] |
  r32 beses'[ ees'' ges''] beses''[ ges'' ees'' beses'] r32 b[ f' aes'] c''[ aes' f' b] |
  \clef bass r32 f[ aes des'] f'[ des' aes f] r32 f[ aes des'] f'[ des' aes f] |
  % System 3: measures 44–46.
  r32 f[ aes des'] f'[ des' aes f] r32 f[ aes des'] f'[ des' aes f] |
  \clef treble r32 ees'[ ges' bes'] ees''[ bes' ges' ees'] r32 ges'[ bes' des''] ges''[ des'' bes' ges'] r32 ees''[ ges'' bes''] des'''[ bes'' ges'' ees''] |
  \down c''32[ d''! ges'' aes''] \up \transpose c c' { \ottava #1 c''32[ d''! ges'' aes''] bes''[ aes'' ges'' d''] c''32 } \ottava #0 \down aes''[ ges'' d''] \up |
  % System 4: measures 47–49.
  \down c''32[ d''! ges'' aes''] \up \transpose c c' { \ottava #1 c''32[ d''! ges'' aes''] bes''[ aes'' ges'' d''] c''32 } \ottava #0 \down aes''[ ges'' d''] \up |
  \down c''32[ d''! ges'' aes''] \up \transpose c c' { \ottava #1 c''32[ d''! ges'' aes''] bes''[ aes'' ges'' d''] c''32 } \ottava #0 \down aes''[ ges'' d''] \up |
  \down c''32[ \up aes' ges' d'!] c'32[ \down \clef bass aes ges d] c32 aes,[ ges, d,] c,32 \ottava #-1 aes,,[ ges,, d,,] \ottava #0 \up |
  % System 5: measures 50–54.
  s2. <aes ees'>8[ <bes ees'>8~] |
  <bes ees'>8 s4. |
  <ges' c'' ees''>8[ <aes' des'' f''> <bes' ees'' ges'' ees'''> <c'' f'' aes''>8] |
  des''8[ <c'' ges'' aes''> <bes' ees'' ges'' ees'''> <c'' f'' aes''>] |
  des''8 <aes' ees'' f''>8~ <aes' des'' aes''>8 <f' c'' f''>8 |
  % System 6: measures 55–60.
  <ees' bes' ees''>8[ <c' ees' aes' c''> <bes des' ges' bes'> <aes c' ees' aes'>] |
  <ges bes des' ges'>8[ <aes c' f'> <bes des' ees'> <c' f' aes'>] |
  <ges bes des' ges'>8[ <aes c' f'> <bes des' ees'> <c' f' aes'>] |
  s2 | s2 |
  s8 \down des,32[ aes, ges \up \set tieWaitForNote = ##t aes~ des'~ aes'~] <aes des' aes'>4_\fermata \set tieWaitForNote = ##f |
}

lowerExtra = \absolute {
  \global \clef bass \voiceThree
  s2*7 | s4 e8[ d8] | s2*7 |
  \clef treble s8 des''16-! r16 ees''16-! r16 f''16-! r16 |
  s2*21 | s2*7 | s2. | s2*4 | s1 |
  \clef bass aes8[ bes c' f'] | f'8[ ges' \clef treble ges' aes'] |
  f'8[ ees' ges' aes'] | f'8 \clef bass <des' f'>8[ <bes ees'> <aes des'>] |
  s2*3 | f8 ees4 f8~ | f8[ ees] des4~-1 | des8 s4. s16 |
}
dynamics = {
  s2_\markup { \italic "con" \musicglyph "pedal.Ped" } | s2*2 |
  s8 s4._\markup\italic "cresc." | s8\f\< s8 s4\! |
  s8 s4._\markup\italic "dim." | s2 |
  s8\< s8\! s8\< s8\> | s2\! |
  s4_\markup\italic "dim." s4 | s2\p |
  s2 | s2\< | s2\! |
  s2_\markup\italic "cresc." | s2*4 |
  s2 | s8 s4.\< | s2\! | s2\< | s2\! | s2 |
  s2_\markup\italic "cresc." | s4\f s8 s8\> | s2\!_\markup\italic "dim." |
  s2 | s2\p | s2*3 | s8\f s4. | s2\> | s2\! | s2\< |
  s2\> | s2\!\pp | s2 | s2 | s2 | s2\< |
  s2 | s2.\!\pp | s2 | s2_\markup\italic "cresc." | s2 | s2 |
  s4 s4\f\> s4\!_\markup\italic "molto legato" s4 | s2_\markup\italic "cresc." |
  s2 | s2\> | s2\! | s2*2 | s2\< | s2\! | s2 | s8 s4.\p s16 |
}
pedals = {
  s2*13 |
  s8\sustainOn s8\sustainOff s8\sustainOn s8\sustainOff |
  s8\sustainOn s8\sustainOff s8\sustainOn s8\sustainOff |
  s2\sustainOn | s4. s8\sustainOff | s2*2 |
  s2*18 |
  s2*3 |
  s8\sustainOn s8\sustainOff s8\sustainOn s8\sustainOff |
  s8\sustainOn s8\sustainOff s8\sustainOn s8\sustainOff |
  s2*2 |
  s8\sustainOn s8\sustainOff s8\sustainOn s8\sustainOff s8\sustainOn s8\sustainOff |
  s4.\sustainOn s8\sustainOff |
  s4.\sustainOn s8\sustainOff | s4.\sustainOn s8\sustainOff |
  s8\sustainOn s8\sustainOff s4 |
  s4 s4\sustainOn s8\sustainOff s4. |
  s2*9 | s8 s4.\sustainOn s16\sustainOff |
}
\score {
  \new PianoStaff \with { instrumentName = "PIANO" } <<
    \new Staff = "upper" << \mergeDifferentlyHeadedOn \mergeDifferentlyDottedOn \new Voice = "melody" \melody \new Voice = "arpeggios" \arpeggios >>
    \new Dynamics \dynamics
    \new Staff = "lower" << \mergeDifferentlyHeadedOn \mergeDifferentlyDottedOn \new Voice = "bassmelody" \lowerMelody \new Voice = "extra" \lowerExtra >>
    \new Dynamics \pedals
  >>
  \layout { \context { \Voice \consists "Merge_rests_engraver" }
    \context { \Score \override SpacingSpanner.shortest-duration-space = #1.5 }
  }
}
