\version "2.24.3"
\language "nederlands"
#(set-global-staff-size 17)
\header { title = "Le sommeil de l'enfant" subtitle = "Berceuse" composer = "Teresa Carreño" opus = "Op. 35" dedication = "À mon père" tagline = ##f }
\paper { #(set-paper-size "a4") top-margin=10\mm bottom-margin=10\mm }
global = { \key f \major \time 6/8 }
upper = \absolute {
 \global \tempo "Allegretto quasi andante" 4. = 48
 % Page1: systems3+4+5+5.
 R2. | R2. | a'4(^\markup\italic "con espress." a'8 d''4 d''8) | \break
 d''4( c''8 bes'4\< f''8\! | f''4\> a'8\! gis'4\< d''8\! |
 c''4\> f'8\! g'4\< gis'8\! | a'4.\> r4 r8)\! | \break
 R2. | a'4( a'8 d''4 d''8 | d''4 c''8 b'!4_\markup\italic "cresc." f''8 |
 e''4 a'8 b'!4 c''8) | a'4. r4 f''8(\f | \break
 e''4 a'8 b'!4 c''8) | a'4. r4 d''8(\p |
 c''4 f'8 g'4 a'8 | f'4) r8 r4 r8 | R2. | \pageBreak
 % Page2: systems4+4+4+5+4.
 a'4( a'8 d''4 d''8 | d''4 c''8 b'!4_\markup\italic "espress." f''8 |
 f''4 a'8 gis'4\< d''8\! | c''4 f'8 g'4\> gis'8\! | \break
 a'4. r4 r8) | a'4^\markup\italic "sempre legato" a'8 d''4 d''8^^ |
 d''4^^ c''8 b'!4\< f''8\! | e''4 a'8 b'!4\> c''8\! | \break
 a'4. r4 f''8\p | e''4^^ a'8^\markup\italic "poco rit." b'!4 c''8 |
 a'4.^\markup "a tempo" r4 a'8 | b'4(^\markup\italic "un poco agitato" a'8 g'4 a'8 | \break
 b'4 a'8 g'4 a'8 | b'4\< b'8 e''4^^ d''8\! |
 cis''4.~^\markup\italic "tranquillo" cis''4\> b'8\! |
 b'4^^ a'8 g'4 a'8 | b'4^^ a'8 g'4 a'8 | \break
 b'4\< b'8 e''4\! d''8 |
 cis''4 cis''8 e''4 d''8^\markup\italic "accell." |
 cis''4 cis''8 e''4 d''8 | cis''4 cis''8 c''!4 cis''8) | \pageBreak
 % Page3: systems5+4+4+5+4.
 c''4^\markup\italic "calmandosi" c''8 b'!4_\markup\italic "dim." b'8 |
 bes'4^\markup\italic "rit." bes'8 a'4 g'8 |
 f'4^\markup "a tempo" r8 r4 r8 | R2. |
 a'4(^\markup\italic "tranquillo" a'8 d''4\< d''8\! | \break
 d''4\sf c''8 bes'4.\pp\< \!  |
 a'4\> a'8\! gis'4.\pp |
 f'4\< f'8\! g'4 gis'8 | a'4. r4 r8) | \break
 a'4( a'8 d''4 d''8 | d''4 c''8 b'!4 f''8_\markup\italic "cresc." |
 e''4 a'8 b'!4 c''8) | a'4 r8 r4 f''8(\f | \break
 e''4 a'8 b'!4 c''8) | a'4 r8 r4 d''8( |
 c''4^\markup\italic "poco riten."\p f'8 g'4 a'8 | f'4) r8 r4 r8 |
 f'4^\markup "a tempo" f'8 fis'4^\markup\italic "poco" fis'8 | \break
 g'4^\markup\italic "a poco cres — cen — do" g'8 c''4 b'8 |
 as'4 r8 r4 r8 | as'4 as'8 a'!4 a'8 |
 ais'4 ais'8 dis''4 cis''8 | \key b \major \pageBreak
 % Page4: systems5+4+5+4+4.
 b'4\f b'8 dis''4 b'8 | gis'4\< gis'8 ais'4\! ais'8 |
 b'4\> b'8 dis''4 b'8 | gis'4 gis'8 ais'4\! ais'8 |
 b'4 b'8 dis''4^^ cis''8\f | \break
 bis'4^\markup\italic "stretto" bis'8 dis''4^^ cis''8 |
 bis'4\< bis'8 dis''4 cis''8\! |
 bis'4\> bis'8 dis''4^\markup\italic "dolcemente e tranquillo" cis''8 |
 b'4 b'8 dis''4\p b'8\! | \break
 gis'4 gis'8 ais'4 ais'8 | b'4 b'8 dis''4^^ b'8 |
 gis'4\< gis'8 ais'4\! ais'8 | b'4\< b'8 bis'4\! bis'8 |
 cis''4\> cis''8 c''!4\! c''8 | \break
 bis'4\< bis'8 b'!4\! b'8 | cis''4\> cis''8 bis'4\! bis'8 |
 b'!4 b'8 c''!4^^ c''8^^_\markup\italic "dim." |
 c''!4^^ c''8^^ c''4^^ c''8 | \break
 b'!4^^ b'8 a'4^^ a'8 | bes'4^^ bes'8 a'!4^^ g'!8 |
 \key f \major f'4^\markup "a tempo"\pp r8 r4 r8 |
 r8 r8 r8 r8 r8 r8 | \pageBreak
 % Page5.
 a'4^\markup\italic "molto espress." a'8\< d''4\! d''8^^ |
 d''4^^ c''8 b'!4\< f''8\! |
 f''4\> a'8\! gis'4\< d''8\! |
 c''4\> f'8\! g'4\< gis'8\! | a'4. r4 r8 | \break
 a'4 a'8 d''4 d''8 |
 d''4 c''8 b'!4 f''8 | e''4 a'8 b'!4 c''8 | a'4 r8 s4. | \break
 c''4 c''8 b'!4 c''8 |
 a'4 r8 s4.^\markup\italic "una corda"\pp |
 f'4\< f'8 g'4^\markup\italic "rit." a'8\! | f'4 r8 r4 r8 | \break
 f'4^\markup\italic "tre corde" f'8 ges'4 g'!8 |
 g'!4 g'8 ges'4 g'!8 | f'4 r8 r4 r8 |
 f'4 f'8 ges'4 g'!8 | g'!4 g'8 ges'4 g'!8 | \break
 f'4^\markup\italic "calando" f'8 g'!4 a'8 |
 f'4^\markup\italic "una corda" f'8 g'4 a'8 |
 f'4 f'8 g'4\ppp c''8^^~ |
 c''2. | a'2.\ppp~ | a'2.\fermata \bar "|."
}
inner = \absolute {
 \global
 s2. | s2. | s4. d''8 <f' as'>8 d''8 |
 d''8 <e' g'> c'' s4. | s2. | s4. g'8 <bes e'> gis'8 | s2. |
 s2. | s4. d''8 <f' as'> d'' | d''8 <e' g'> c'' s4. |
 s2. | s8*5 <f' b'!>8 |
 <e' a'>4 s8 s4. | s8*5 <d' f'>8 |
 <c' f'>4 s8 g'8 <bes e'> a' | s2. | s2. |
 s4. d''8 <f' as'> d'' | d''8 <e' g'> c'' s4. |
 s2. | s4. g'8 <bes e'> gis'8 |
 s2. | s4. d''8 <f' as'> d'' | d''8 <e' g'> c'' s4. | s2. |
 s8*5 <f' b'!>8 | <e' a'>4 s8 s4. | s2. |
 b'8 <cis' e'> a' g' <cis' e'> a' |
 b'8 <cis' e'> a' g' <cis' e'> a' | b'8 <cis' e'> b' e'' <e' g'> d'' |
 cis''8 <e' g'> cis'' cis'' <e' g'> b' |
 b'8 <cis' e'> a' g' <cis' e'> a' | b'8 <cis' e'> a' g' <cis' e'> a' |
 b'8 <cis' e'> b' e'' <e' b'> d'' |
 cis''8 <e' a'> cis'' e'' <e' b'!> b'! |
 cis''8 <e' a'> cis'' e'' <e' gis'> d'' |
 cis''8 <e' g'!> cis'' c''! <es' ges'> cis'' |
 c''8 <f' a'> c'' b'! <f' a'> b' |
 bes'8 <f' a'> bes' a' <es' g'> <d' f'> |
 <a c'>8 <a c'> r8 r4 r8 | s2. | s4. d''8 <f' as'> d'' |
 d''8 <e' g'> c'' \tuplet 8/6 { bes'16( \tiny d'' f'' a'' g'' f'' d'' bes') \normalsize } |
 s4. \tuplet 8/6 { gis'16( \tiny b'! e'' d'' b' g' d' e') \normalsize } | s4. g'8 <bes e'> gis'8 | s2. |
 s4. d''8 <f' as'> d'' | d''8 <e' g'> c'' s4. | s2. | s8*5 <f' b'!>8 |
 <e' a'>4 s8 s4. | s8*5 <d' f'>8 | <c' f'>4 s8 g'8 <bes e'> a' | s2. |
 f'8 <a c'> f' fis' <ais cis'> fis' |
 g'8 <bes c'> g' c'' <des' e'> b' |
 as'8 <c' fes'>4 r8 <c' fes'>4 |
 as'8 <des' fes'> as' a'! <cis' e'> a' |
 ais'8 <cis' e'> ais' dis'' <eis' fis'> cis'' | \key b \major
 b'8 <dis' fis'> b' dis'' <dis' fis'> b' |
 gis'8 <b e'> gis' ais' <cis' e'> ais' |
 b'8 <dis' fis'> b' dis'' <dis' fis'> b' |
 gis'8 <ais dis'> gis' ais' <dis' e'> ais' |
 b'8 <dis' fis'> b' dis'' <dis' fisis'> <cis' cis''> |
 bis8 fis' bis dis' fisis' cis' |
 bis8 fis' bis dis' fisis' cis' |
 bis8 fis' bis' dis' fis' cis'' |
 b'8 <dis' fis'> b' dis'' <dis' fis'> b' |
 gis'8 <b e'> gis' ais' <dis' e'> ais' |
 b'8 <dis' fis'> b' dis'' <dis' fis'> b' |
 gis'8 <ais dis'> gis' ais' <dis' e'> ais' |
 b'8 <dis' fis'> b' bis' <dis' g'> bis' |
 cis''8 <e' g'> cis'' c''! <e' g'> c'' |
 bis'8 <dis' fisis'> bis' b'! <e' g'> b' |
 cis''8 <e' g'> cis'' bis' <e' g'> bis' |
 b'!8 <dis' fis'> b' c''! <e' g'> c'' |
 c''!8 <c' e'> c'' c'' <c' e'!> c'' |
 b'!8 <cis' f'!> b' a' <cis' f'> a' |
 bes'8 <des' fes'> bes' a'! <d'! f'!> <ces' es'> |
 \key f \major <a c'>8 <a c'> r8 r4 <a c'>8 |
 r8 <a c'>4 r8 <a c'>4 |
 s4. d''8 <f' as'> d'' | d''8 <e' g'> c'' s4. |
 s2. | s4. g'8 <bes e'> gis'8 |
 s2. | s4. d''8 <f' as'> d'' | d''8 <e' g'> c'' s4. | s2. |
 s4. \tuplet 7/6 { f''16(\mf c''' f'' d'' bes' f' g') } |
 s2. |
 s4. \tuplet 7/6 { bes'16( f'' d'' bes' g' d' e') } |
 f'8 <a c'> f' g' <bes e'> a' |
 f'8 <a c'> r8 r4 r8 |
 f'8 <a c'> f' ges' <bes des'> g'! |
 g'!8 <bes des'> g' ges' <a c'> g'! |
 f'8 <a c'> r8 r4 r8 |
 f'8 <a c'> f' ges' <bes des'> g'! |
 g'!8 <bes des'> g' ges' <a c'> g'! |
 f'8 <a c'> f' g' <bes e'> a' |
 f'8 <a c'> f' g' <bes e'> a' |
 f'8 <a c'> f' g' <bes e'> c'' |
 <bes e' gis'>2. |
 <a c' f'>2.\arpeggio~ | <a c' f'>2.\fermata


}
bass = \absolute {
 \global \clef bass \set Staff.pedalSustainStyle = #'text
 % Page1
 f8^^(\pp^\markup\italic "tranquillo" \sustainOn <a c'> e^^ d^^ <a c'> e^^ s1*0\sustainOff |
 f8^^\sustainOn <a c'> e^^ d^^ <a c'> e^^) s1*0\sustainOff |
 f8^^\sustainOn <a c'> f f\sustainOff <as b!> f |
 e8 <g c'> e d\sustainOn <f bes d'> d\sustainOff |
 c8 <f a c'> c b,! <gis b! f'> b, |
 c8\sustainOn <a c' f'> c c <g c'> c\sustainOff |
 f8^^(\sustainOn <a c'> e^^ d^^ <a c'> e^^) s1*0\sustainOff |
 f8^^(\sustainOn <a c'> e^^ d^^ <a c'> e^^) s1*0\sustainOff |
 f8^^ <a c'> f f <as b!> f |
 e8 <g c'> e d <f b!> d |
 e8 <g c'> e e <gis d'> e |
 a,8\sustainOn <a c'> c e <a c'>\sustainOff <d as! b!> |
 <e a c'>8\sustainOn <a c'> e\sustainOff e <gis d'> e |
 a,8\sustainOn <a c'> e c a, <bes, f bes>\sustainOff |
 <c f a>8\sustainOn <f a> c c\sustainOff <g c'> c |
 f8^^(\sustainOn <a c'> e^^ d^^ <a c'> e^^) s1*0\sustainOff |
 f8^^(\pp\sustainOn <a c'> e^^ d^^ <a c'> e^^) s1*0\sustainOff |
 % Page2
 f8^^ <a c'> f f <as b!> f |
 e8 <g c'> e d\sustainOn <f b!> d\sustainOff |
 c8\sustainOn <f a c'> c\sustainOff b,!\sustainOn <gis b! f'> b,\sustainOff |
 c8\sustainOn <a c' f'> c c\sustainOff <g c'> c |
 f8^^( <a c'> e^^ d^^ <a c'> e^^) |
 f8^^_\markup\italic "poco cresc." <a c'> f f <as b!> f |
 e8-. <g c'> e d <f b!> d |
 e8-. <g c'> e e <gis d'> e |
 a,8\sustainOn <a c'> c e <a c'> <d as! b!>\sustainOff |
 <e a c'>8\sustainOn <a c'> e\sustainOff e <gis d'> e |
 a,8\sustainOn <a c'> c e <a c'> f\sustainOff |
 e4 f8 g4 f8 |
 e4 f8 g4 f8 | e4. bes4.^^ |
 a4^\markup\italic "tranquillo" e8 cis4 a,8 |
 e'4^^ f8 g4 f8 | e4^^ f8 g4 f8 |
 e4. gis4. | a4. gis4. | a4. b!4. | a4. as4. |
 % Page3
 g2.\sustainOn s1*0\sustainOff | g4. c4. |
 f4\sustainOn e8 d^^ <a c'> e^^\sustainOff |
 f8^^\sustainOn <a c'> e^^ d^^ <a c'> e^^ s1*0\sustainOff |
 f8^^\sustainOn <a c'> f\sustainOff f <as b!> f |
 e8 <g c'> e d\sustainOn <f bes d'> d\sustainOff |
 c8\sustainOn <f a c'> c\sustainOff d\sustainOn <gis b! f'> b,!\sustainOff |
 c8\sustainOn <a c' f'> c c <g c'> c |
 f8^^ <a c'> e^^ d^^ <a c'> e^^ |
 f8^^ <a c'> f f <as b!> f |
 e8 <g c'> e d <f b!> d |
 e8 <g c'> e e <gis d'> e |
 a,8\sustainOn <a c'> c e <a c'>\sustainOff <d as! b!> |
 <e a c'>8 <a c'> e e <gis d'> e |
 a8 <c' e'> e a, <e a> <b, f g> |
 <c f a>8 <f a> c c <e bes> c |
 f8^^ <a c'> e^^ d^^ <a c'> e^^ |
 f4.^^ e4. |
 es4.\sustainOn des,4. s1*0\sustainOff |
 as,4 g'8 f4 g8 | as4. f4. |
 fis4. fis,4. | \key b \major
 % Page4
 b,4.\sustainOn <b, fis>4. s1*0\sustainOff |
 b,4. fis4. |
 <b, fis>4.^^\sustainOn b,4.~ s1*0\sustainOff |
 <b, e>4. cis4. |
 b,4. <ais, dis ais>4. |
 <a,! dis a!>4.^^ <ais, dis ais>4.^^ |
 <a,! dis a!>4.^^ <ais, dis ais>4.^^ |
 <a,! dis a!>4.^^ <ais, cis>4.^^\sustainOn s1*0\sustainOff |
 <b,~ fis>4.\sustainOn <b,~ fis>4. s1*0\sustainOff |
 <b, e>4. cis4. |
 b,4.\sustainOn <b, fis>4.~ s1*0\sustainOff |
 <b, e>4. cis4. |
 b,4. a!4.^^ |
 a!4.^^ ais4. |
 b4.^^ a4. | a!4. ais4. |
 b4. a4.^^ | a!4.^^ gis4.^^ |
 g!4.~\sustainOn g4. s1*0\sustainOff |
 g!4.^^ cis4.^^\sustainOn s1*0\sustainOff |
 \key f \major f4(\sustainOn e8 d4 e8 |
 f4 e8 d4 e8) |
 % Page5
 f8 <a c'> f f <as b!> f |
 e8\sustainOn <g c'> e d <f b!> d\sustainOff |
 c8\sustainOn <f a c'> c\sustainOff b,!\sustainOn <gis b! f'> b,\sustainOff |
 c8\sustainOn <a c' f'> c c\sustainOff <g c'> c |
 f8^^\sustainOn <a c'> e^^ d^^ <a c'> e^^ |
 f8^^ <a c'> f f <as b!> f |
 e8 <g c'> e d <f b!> d |
 e8 <g c'> e e <gis d'> e |
 a,8\sustainOn <a c'> e\sustainOff d\sustainOn <f a d'> d\sustainOff |
 e8\sustainOn <g c'> e e\sustainOff <gis d'> e |
 a,8\sustainOn <a c'> a,\sustainOff b,\sustainOn <f a> d\sustainOff |
 c4 c8 c <g c'> c |
 f4 e8 d\sustainOn <a' c'> e\sustainOff |
 f4.^^ e4. |
 es4.\sustainOn e!4. s1*0\sustainOff |
 f4\sustainOn e8 d <a c'> e^^\sustainOff |
 f4.^^ e4. | es4.\sustainOn e!4. |
 f4. c4.\sustainOn s1*0\sustainOff |
 f4. c4.\sustainOn s1*0\sustainOff |
 f4. c4.\sustainOn |
 <f, c>2.^^ s1*0\sustainOff |
 <f, c f>2.\arpeggio~ | <f, c f>2.\fermata
}
\score {
 \new PianoStaff \with { connectArpeggios = ##t } <<
 \new Staff = "RH" << \mergeDifferentlyDottedOn \mergeDifferentlyHeadedOn \new Voice = "upper" { \voiceOne \upper } \new Voice = "inner" { \voiceTwo \inner } >>
 \new Staff = "LH" { \bass }
 >>
 \layout { \context { \Score \override BarNumber.break-visibility = ##(#f #f #t) } }
}
