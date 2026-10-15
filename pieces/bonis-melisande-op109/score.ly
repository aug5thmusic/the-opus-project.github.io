\version "2.24.3"
% Step 3 reconciliation of two independent visual transcriptions.
% Printed edition: A. Leduc 1925, plate A.L.16,935.
% IMSLP30424, PDF pp. 2–4. Cover says No. 5; music header says No. 4.
% Direct source: https://s9.imslp.org/files/imglnks/usimg/3/39/IMSLP30424-PMLP68553-Bonis_Melisande_piano_2_hands.pdf
% Whole-PDF SHA-256: 2ce22cd38a5e936bdaed69723e5ae5400e1432dfac90a77b07df515563beed06
% Model: openai/gpt-6.1-sol; reasoning xhigh; other settings not exposed.
\header {
 title = "MÉLISANDE"
 subtitle = "Cinq Pièces pour Piano — No 4"
 dedication = "À Monsieur PAUL LOCARD"
 composer = "MEL-BONIS"
 opus = "Op. 109"
 copyright = "Paris : Alphonse Leduc, 1925 · A.L. 16,935"
 tagline = ##f
}
#(set-global-staff-size 16)
\paper { #(set-paper-size "a4") print-page-number = ##t
 top-margin = 10\mm bottom-margin = 10\mm
 left-margin = 12\mm right-margin = 12\mm
 ragged-last-bottom = ##t
}
up = { \voiceOne }
down = { \voiceTwo }
rightMelody = \absolute {
 \autoBeamOff
 \key des \major \time 2/4
 \autoLineBreaksOff \autoPageBreaksOff
 \mergeDifferentlyHeadedOn \mergeDifferentlyDottedOn
 \tempo "Andantino" 4 = 52
 bes'2( | ces''4 es''4) | bes'2( | \break
 ces''4 es''4) | ges''8(^\markup\italic "espress." bes''4-> ges''8 |
 es''8[ c'' bes' as']) | ges'4.( f'8 | \break
 ges'8 as'4 ges'8) | as'4 <f'' as''>8^\markup\italic "m.g." s8 |
 s4 <ges'' as''>8 s8 | bes'8( des''4 a'!8 | \break
 bes'8 \once \override NoteHead.duration-log = #1 des''4 a'!8) | s2 |
 des'''4( f'''8[ ges'''] | es'''8[ des''' es''' f'''] | \break
 es'''8[ des''' es''' f''']) | s2 |
 s8 es'4(^\markup\italic "espress." des'8) |
 r8 as'8(^\markup\italic "m.g." [bes' f'!^\markup\italic "m.d."]) | \pageBreak
}
rightFig = \absolute {
 \autoBeamOff
 \down
 bes'32[ ges' es' c'] s32*9 c'32[ es' ges'] |
 ces''32[ ges' es' ces'] s32*9 ces'32[ es' ges'] |
 bes'32[ ges' es' c'!] s32*9 c'32[ es' ges'] |
 ces''32[ ges' es' ces'] s32*9 ces'32[ es' ges'] |
 ges''32[ es'' bes' ges'] s32*9 ges'32[ bes' es''] |
 es''32[ bes' ges' es'] s32*9 ces'32[ d'! f'] |
 ges'32[ es' bes ges] s32*9 a!32[ c' es'] |
 ges'32[ d'! c' ges] s32*5 ges32[ c' d'] ges'32[ d' c' ges] |
 s8 c'32[ f' as' c''] f''32[ c'' as' f'] c'32 s32*3 |
 s32*5 c'32[ ges' as'] ges''32[ as' ges' c'] s8 |
 bes'32[ ges' des' ges'] des''32[ ges' des' ges'] r32 ges'32[ des' ges'] a'!32[ ges' des' ges'] |
 bes'32[ ges' des' ges'] des''32[ ges' des' ges'] r32 ges'32[ des' ges'] a'!32[ ges' des' ges'] |
 r32 ges'32[ bes' ges'] r32 ges'32[ bes' des''] r32 bes'32[ des'' ges''] r32 des''32[ ges'' bes''] |
 s32*5 des''32[ f'' as''] s32*5 f''32[ bes'' des'''] |
 s32*5 des''32[ f'' a''!] s32*5 f''32[ ces''' des'''] |
 s8 des'''32[ f'' bes'' des'''] es'''32[ f'' bes'' des'''] f'''32[ f'' bes'' es'''] |
 r32 f''32[ bes'' des'''] f'''32[ des''' bes'' f''] des''32[ \change Staff = "LH" \voiceOne bes' f' des'] \stemDown bes32 \stemUp \clef bass ges32[ es c] \stemNeutral \change Staff = "RH" \voiceTwo |
 \change Staff = "LH" \voiceOne \once \override Rest.staff-position = #6 r32 des32[ ges bes \change Staff = "RH" \voiceTwo es' \change Staff = "LH" \voiceOne bes ges des] ges32[ des ges bes \change Staff = "RH" \voiceTwo des' \change Staff = "LH" \voiceOne bes ges des] \change Staff = "RH" \voiceTwo |
 r32 fis32[ c' d'!] r32 d'32[ c' fis] r32 fis32[ c' d'] f'!32[ d' c' fis] |
}
leftMelody = \absolute {
 \autoBeamOff \mergeDifferentlyHeadedOn \mergeDifferentlyDottedOn
 \clef bass \key des \major \time 2/4 \up
 s2*4 |
 s8 des'4 des'8 | s2*2 |
 s8 d!8 e!4 |
 f4-2-> s4 | es4-> s4 |
 \clef treble es'8([ f' es' d'!] |
 es'8[ f' es' d'!] | des'8[ es' des' c'] |
 \down ces'4)( bes4 | a!4 as4 |
 g!4) s4 |
 bes'''8^\markup\italic "croisez" r8 s4 |
 \clef bass \down <ges,, ges,>2 |
 <d,! a,! d!>4 r4 |
}
leftFig = \absolute {
 \autoBeamOff
 \down
 s8 bes32[ ges es as,] es[ as, es ges] bes32 s32*3 |
 s8 beses32[ es ces ges,] ces[ ges, ces es] beses32 s32*3 |
 s8 bes32[ ges es as,] es[ as, es ges] bes32 s32*3 |
 s8 beses32[ es ces ges,] ces[ ges, ces es] beses32 s32*3 |
 s8 des'32[ ges es as,] es[ as, es ges] des'32 s32*3 |
 s8 as32[ ges es as,] d![ as, d f] as32 s32*3 |
 s8 es32[ bes, ges, es,] bes,[ es, bes, es] ges32 s32*3 |
 s8 d!32([ a,! c,! a,] e!8[ d!8]) |
 f32[ as, f as] s32*9 as32[ f as,] |
 es32[ as, es as] bes32 s32*7 as32[ ges es as,] |
 s2*3 |
 \up ces'32[ des' f' as'] ces''32 s32*3 bes32[ des' f' bes'] des''32 s32*3 |
 a!32[ ces' des' f'] a'!32 s32*3 as32[ ces' des' f'] ces''32 s32*3 |
 << { g!32[ des' f' bes'] s4. } \\ { s8 des''16^! r16 es''16^! r16 f''16^! r16 } >> |
 s2 |
 s2 |
 s2 |
}
dynamics = {
 s2 | s2 | s2 |
 s8 s4._\markup\italic "cresc." |
 s8\< s8\f\! s4 |
 s8_\markup\italic "dim." s4. | s2 |
 s16\< s16\! s8\< s8\> s8\! |
 s2 | s2_\markup\italic "dim." |
 s2\p | s2 | s2\< |
 s2\! | s2_\markup\italic "cresc." | s2 |
 s2 | s2 | s8 s8\< s4\! |
}
pedal = {
 s2_\markup { \italic "con" \musicglyph "pedal.Ped" } s2*12 |
 s8\sustainOn s8\sustainOff s8\sustainOn s8\sustainOff |
 s8\sustainOn s8\sustainOff s8\sustainOn s8\sustainOff |
 s2\sustainOn | s4. s16. s32\sustainOff |
 s2*2 |
}
rightMelodyB = \absolute {
 s8 es'4(^\markup\italic "espress." des'8) | r8 bes'8(^\markup\italic \column { "m.g." "espress." } [ces'' g'!^\markup\italic "m.d."]) |
 ges'8([ f' es' d'!]) | \break
 es'8([ ges' as' bes']) | ces''8([ bes' as' g'!]) | as'8([ bes' ces'' des'']) | \break
 es''8( ges''4 d''!8 | es''8 ges''4 d''!8) | des''8([ es'' bes' ces'']) | \break
 g'!8([^\markup\bold "cédez" as' g' as']) |
 \tempo "a Tempo" a'!2( | bes'4 es''4) | \break
 a'!2(^\markup\italic "animato" | bes'4 es''4) |
 ges''8(^\markup\italic "appassionato" bes''4 \once \override NoteHead.duration-log = #1 as''8 | \break
 ges''8[ es'' c'' bes']) |
 beses'4.(^\markup\italic "calmato" as'8 | beses'4. as'8 | \pageBreak
}
rightFigB = \absolute {
 \change Staff = "LH" \voiceOne \once \override Rest.staff-position = #6 r32 des32[ ges bes \change Staff = "RH" \voiceTwo es' \change Staff = "LH" \voiceOne bes ges des] ges32[ des ges bes \change Staff = "RH" \voiceTwo des' \change Staff = "LH" \voiceOne bes ges des] \change Staff = "RH" \voiceTwo |
 r32 g!32[ des' es'] r32 es'32[ des' g] r32 g32[ des' es'] g'!32[ es' des' g] |
 ges'32[ c' ges c'] f'32[ c' ges c'] es'32[ c' ges c'] d'!32[ c' ges c'] |
 es'32[ c' ges c'] ges'32[ es' c' es'] as'32[ ges' c' ges'] bes'32[ ges' c' ges'] |
 ces''32[ f' ces' f'] bes'32[ f' ces' f'] as'32[ f' ces' f'] g'!32[ f' ces' f'] |
 as'32[ f' ces' f'] bes'32[ as' f' as'] ces''32[ as' f' as'] des''32[ bes' f' bes'] |
 es''32[ ces'' ges' ces''] ges''32[ ces'' ges' ces''] r32 ces''32[ ges' ces''] d''!32[ ces'' ges'? ces''] |
 es''32[ ces'' ges' ces''] ges''32[ ces'' ges' ces''] r32 ces''32[ ges' ces''] d''!32[ ces'' ges' ces''] |
 des''32[ ces'' as' ces''] es''32[ ces'' as' ces''] bes'32[ fes' des' fes'] ces''32[ fes' des' fes'] |
 g'!32[ f'! ces' f'] as'32[ f' ces' f'] g'32[ f' ces' f'] as'32[ f' ces' f'] |
 a'!32[ fis' c' a!] s32*9 a32[ c' fis'] |
 bes'32[ ges' es' des'] s32*9 c'32[ es' ges'] |
 a'!32[ fis' c' a!] s32*9 a32[ c' fis'] |
 bes'32[ ges' es' des'] s32*9 c'32[ es' ges'] |
 ges''32[ d''! c'' as'] s32*9 as'32[ c'' d''] |
 ges''32[ c'' as' ges'] es''32[ \change Staff = "LH" \voiceOne c' as ges] es32[ c es ges] as32[ c' \change Staff = "RH" \voiceTwo es' ges'] |
 beses'32[ ges' d'! c'] s32*9 ges'32[ d' c'] |
 beses'32[ ges' d'! c'] s32*9 ges'32[ d' c'] |
}
leftMelodyB = \absolute {
 \clef bass \down <ges,, ges,>2 | <es, bes, es>4 r4 |
 <as,, as,>8 \clef treble d''!8^![ es''^! ges''^! ] |
 bes''8^. r8 \clef bass \up <eses, eses>4~ |
 <eses, eses>8 \clef treble \down g''!8^![ as''^! ces'''^! ] |
 es'''8 r8 \clef bass \up <ces, ces>4~ |
 <ces, ces>8 \clef treble bes'8([ as' g'!] |
 as'8[ bes' as' ges'] |
 f'8) r8 \clef bass \down g!8 r8 |
 \up d!4~ <d, d!>4~ |
 <d, d!>8 \up gis4( fis8) |
 s8 des'4( bes8) |
 s8 gis4( fis8) |
 s8 des'4( bes8) |
 s8 ges'4( f'8 | es'8) s4. |
 s2*2 |
}
leftFigB = \absolute {
 \up s2 |
 s2*8 |
 s2 |
 \down s8 gis32[ c a,! d,!] a,[ d, a, c] fis32 s32*3 |
 s8 des'32[ ges es as,] es[ as, es ges] bes32 s32*3 |
 s8 gis32[ c a,! d,!] a,[ d, a, c] fis32 s32*3 |
 s8 des'32[ ges es as,] es[ as, es ges] bes32 s32*3 |
 s8 ges'32[ e'! c' as] c'[ as c' e'] f'32 s32*3 |
 s2 |
 s8 as32[ ges d! c] as,[ c d ges] as32 s32*3 |
 s8 as32[ ges d! c] as,[ c d ges] as32 s32*3 |
}
dynamicsB = {
 s2 | s8 s8\< s4\! | s2 |
 s2\< | s2\!_\markup\italic "cre -" | s2_\markup\italic "- scen -" |
 s2_\markup\italic "- do" | s4.\f s8\> | s4\! s4_\markup\italic "dim." |
 s4\> s4 | s2\p\! | s2 |
 s2 | s2 | s8 s4.\f |
 s8\> s4.\! | s2 | s2\< |
}
pedalB = { s2*18 }

rightMelodyC = \absolute {
 \set Score.currentBarNumber = #38 beses'4^\markup\bold "rit." as'8[ ges'8]) |
 \tempo "a Tempo" r8 <f' as' c''>8(^\markup\italic "m.g." [<bes' es''> <f' as' c''>] |
 <bes' es''>8[ <f' as' c''> <bes' es''> <f' as' c''>]) | \break
 \down <des' ges' bes'>8 r8 <bes es' ges'>8 r8 |
 s2 | \tempo "a Tempo" \clef bass s2 | \break
 s2 | \clef treble
 % Bar 45: three complete eighth-note pairs, without a printed time change.
 \once \override Score.TimeSignature.stencil = ##f \time 3/4 s2.^\markup\bold "Stretto" |
 \once \override Score.TimeSignature.stencil = ##f \time 2/4 s2 | \break
 s2*3 | \break
 % Bar 12: the printed open Db5 head retains quarter timing.
 % Bar 34: the printed open Ab5 head retains its eighth timing/flag.
 % Bar 50: contradictory printed voices are aligned in 7/8.
 % Both lower-stream middle quarters retain quarter glyphs but have 1/8
 % internal timing. See RECONCILIATION.md; the print shows no new meter.
 \tempo "Lento"
 \once \override Score.TimeSignature.stencil = ##f \time 7/8
 \up s4 c'4~ c'16[ <bes des'>16] as'4~ |
 \once \override Score.TimeSignature.stencil = ##f \time 2/4
 as'8[ <c' f' as' c''> <es' ges' bes' es''> <f' bes' des'' f''>] |
 as''4 s8 as''8~ | as''8 s4 as''8~ | as''8 s4. | \break
 s2*3 |
 <bes des' ges' bes'>2 |
 <bes ges' bes' des''>2~ |
 % Bar 60: five 32nds, no supplied sixth note or tuplet.
 \once \override Score.TimeSignature.stencil = ##f \time 17/32
 <bes ges' bes' des''>4 s32 <f'' as''>4^\markup\italic "m.g."\fermata \bar "|."
}
rightFigC = \absolute {
 beses'32[ ges' d'! c'] s4 ges'32[ c' d' c'] |
 \change Staff = "LH" \voiceOne des32[ f as \change Staff = "RH" \voiceTwo des'] f'32[ des' \change Staff = "LH" \voiceOne as f] \once \override Rest.staff-position = #6 r32 f32[ as \change Staff = "RH" \voiceTwo des'] f'32[ des' \change Staff = "LH" \voiceOne as f] \change Staff = "RH" \voiceTwo |
 \change Staff = "LH" \voiceOne \once \override Rest.staff-position = #6 r32 f32[ as \change Staff = "RH" \voiceTwo des'] f'32[ des' \change Staff = "LH" \voiceOne as f] \once \override Rest.staff-position = #6 r32 f32[ as \change Staff = "RH" \voiceTwo des'] f'32[ des' \change Staff = "LH" \voiceOne as f] \change Staff = "RH" \voiceTwo |
 \up r32 f''32[ bes'' des'''] f'''32[ des''' bes'' f''] r32 des''32[ ges'' bes''] des'''32[ bes'' ges'' des''] |
 r32 beses'32[ es'' ges''] beses''32[ ges'' es'' beses'] r32 b!32[ f' as'] c''32[ as' f' b] |
 r32 f32[ as des'] f'32[ des' as f] r32 f32[ as des'] f'32[ des' as f] |
 r32 f32[ as des'] f'32[ des' as f] r32 f32[ as des'] f'32[ des' as f] |
 r32 es'32[ ges' bes'] es''32[ bes' ges' des'] r32 bes'32[ des'' f''] bes''32[ f'' des'' bes'] r32 es''32[ ges'' bes''] es'''32[ bes'' ges'' es''] |
 \stemNeutral \change Staff = "LH" \voiceOne \once \hide NoteHead c''32[ d''! ges'' as''] \change Staff = "RH" \voiceTwo \ottava #1 c'''32[ d'''! ges''' as'''] bes'''32[ as''' ges''' d'''] c'''32[ \ottava #0 \change Staff = "LH" \voiceOne as'' ges'' d''] \change Staff = "RH" \voiceTwo |
 \stemNeutral \change Staff = "LH" \voiceOne \once \hide NoteHead c''32[ d''! ges'' as''] \change Staff = "RH" \voiceTwo \ottava #1 c'''32[ d'''! ges''' as'''] bes'''32[ as''' ges''' d'''] c'''32[ \ottava #0 \change Staff = "LH" \voiceOne as'' ges'' d''] \change Staff = "RH" \voiceTwo |
 \stemNeutral \change Staff = "LH" \voiceOne \once \hide NoteHead c''32[ d''! ges'' as''] \change Staff = "RH" \voiceTwo \ottava #1 c'''32[ d'''! ges''' as'''] bes'''32[ as''' ges''' d'''] c'''32[ \ottava #0 \change Staff = "LH" \voiceOne as'' ges'' d''] \change Staff = "RH" \voiceTwo |
 \down \change Staff = "LH" \voiceOne c''32[ \change Staff = "RH" \voiceTwo as' ges' d'!] c'32[ \change Staff = "LH" \voiceTwo as ges d!] c32 \voiceOne as,32[ ges, d,!] c,32 \ottava #-1 \voiceTwo as,,32[ ges,, \once \omit Accidental d,,] \ottava #0 \change Staff = "RH" \voiceTwo |
 s4 bes4~ \scaleDurations 1/2 { bes4 } <as es'>8[ <bes~ des'>8] |
 <bes es'>8 s4. |
 <ges' c'' es''>8[ <as' des'' f''> <bes' es'' ges'' es'''> <c'' f'' as''>] |
 des''8[ <c'' ges'' as''> <bes' es'' ges'' es'''> <c'' f'' as''>] |
 des''8[ <as'~ es'' f''> <as' des'' as''> <f' c'' f''>] |
 \up <es' bes' es''>8[ <c' es' as' c''> <bes des' ges' bes'> <as c' es' as'>] |
 <ges bes des' ges'>8[ <as c' f'> <bes des' es'> <c' f' as'>] |
 <ges bes des' ges'>8[ <as c' f'> <bes des' es'> <c' f' as'>] |
 s2*2 |
 s8 \stemNeutral \set tieWaitForNote = ##t \change Staff = "LH" \voiceOne \once \override Beam.positions = #'(3 . 10) as,32[ f \change Staff = "RH" \voiceTwo as~ des'~ as'~] <as des' as'>4_\fermata |
}
leftMelodyC = \absolute {
 s2 | \down <des, as, des>4 \once \override Staff.RestCollision.positioning-done = ##t \once \override Rest.staff-position = #-6 r4 | s2*2 |
 <ges ces' es'>8 r8 <as, es ges>8 r8 |
 \up <des, as, des>8 \down <c' es'>8([ <bes as'> <c' es'>] |
 <bes as'>8_\markup\italic "poco rubato"[ <c' es'> <bes as'> <c' es'>]) |
 <des ges bes>8 r8 <ges bes des' f'>8 r8 \clef treble <c' es' ges' bes'>8 r8 |
 \up c''2-> | c''2-> | c''2-> |
 \up c''8 s4. |
 \clef bass \down \ottava #-1 c,,8 \ottava #0 \once \override Rest.staff-position = #0 r8
 \down <as,, as,~ es~ ges~>4
 \scaleDurations 1/2 { <des, as, es ges>4 }
 <des,~ as,~ f>4 |
 <des, as,>8 s8 es4 |
 as4 \clef treble des'4~ |
 des'4 des'4~ |
 des'8 \clef bass <des' f'>8[ <bes es'> <as des'>] |
 <ges bes es'>8[ <f as>8-2 <ges, des ges> <as, es>] |
 <des, as, es>8[ <f, c f> <ges, des ges> <des as>] |
 <des, as, es>8[ <f, c f> <ges, des ges> <des as>] |
 ges,2~ | ges,4. f,8( |
 es,8 des,4.) s32 |
}
leftFigC = \absolute {
 \down s8 as32[ ges d! c] as,32[ c d ges] s8 |
 \up s2 |
 s2 |
 s2*4 s2. |
 s2 |
 s2 |
 s2 |
 s8 \clef bass s4. |
 s16*9 \up \crossStaff { ges16 } s4 |
 \up ges8[ as bes f'] |
 es'8[ f'] \clef treble ges'8([ as'] |
 f'8[ es' ges' as'] |
 f'8) \clef bass ges'4_1 es'8_4~ |
 es'8 s4. s2*2 |
 f8 es4 f8~ |
 f8[ es8] des4_1~ |
 des8 s32*13 |
}
dynamicsC = {
 s2\> | \once \override DynamicText.extra-offset = #'(0 . 3) s2\!\pp | s2 |
 s2_\markup\italic "stretto" | s2 | s2\< |
 s2 |
 s2.\!\pp |
 s2 | s2_\markup\italic "cresc." | s2 | s2 |
 s4 s4\f\> \once \override TextScript.extra-offset = #'(-11 . -1.5) s8\!_\markup\italic "molto legato" s4 |
 s4_\markup\italic "cresc." s4 | s2 | s2\> | s2\! |
 s2 | s2 | s2\< | s2 | s2\!_\markup\italic "rall. e dim." |
 s8 s32\p s4. |
}
pedalC = {
 s2*3 |
 s8\sustainOn s8\sustainOff s8\sustainOn s8\sustainOff |
 s8\sustainOn s8\sustainOff s8\sustainOn s8\sustainOff |
 s2*2 |
 s8\sustainOn s8\sustainOff s8\sustainOn s8\sustainOff s8\sustainOn s8\sustainOff |
 s4.\sustainOn s8\sustainOff |
 s4.\sustainOn s8\sustainOff |
 s4.\sustainOn s8\sustainOff |
 s8\sustainOn s8\sustainOff s4 |
 s4 s4\sustainOn s8\sustainOff s4 |
 s2*9 |
 s8 \once \override SustainPedal.extra-offset = #'(0 . -1) s4.\sustainOn s32\sustainOff |
}

\score {
 \new PianoStaff <<
  \new Staff = "RH" << \new Voice = "melody" { \up \rightMelody \rightMelodyB \rightMelodyC } \new Voice { \rightFig \rightFigB \rightFigC } >>
  \new Dynamics { \dynamics \dynamicsB \dynamicsC }
  \new Staff = "LH" << \new Voice { \leftMelody \leftMelodyB \leftMelodyC } \new Voice { \leftFig \leftFigB \leftFigC } >>
  \new Dynamics { \pedal \pedalB \pedalC }
 >>
 \layout { indent = 12\mm
  \context { \PianoStaff \accepts Dynamics \consists #Span_stem_engraver }
  \context { \Score \override SpacingSpanner.shortest-duration-space = #1.5 }
 }
}
