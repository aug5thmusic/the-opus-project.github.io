\version "2.24.3"
% Reconciled visually from both independent attempts against Heugel H.4875.
% Primary: IMSLP48626, printed pages 1–5; same-plate BNE scan for legibility.
% See RECONCILIATION.md for source readings, disagreements, and review status.
#(set-global-staff-size 17)
\header {
 title = "Le sommeil de l'enfant"
 subtitle = "Berceuse"
 composer = "Teresa Carreño"
 opus = "Op. 35"
 dedication = "À mon père"
 tagline = ##f
}
\paper { #(set-paper-size "a4") top-margin = 10\mm bottom-margin = 10\mm }
right = \absolute {
 \clef treble \key f \major \time 6/8
 \slurUp \tieUp \tupletUp
 \stemUp
 \mergeDifferentlyDottedOn \mergeDifferentlyHeadedOn
 \tempo "Allegretto quasi andante" 4. = 48
 % page 1, system 1: 1–3
 R2. | \stemUp R2. | \stemUp
 a'4( ^\markup\italic "con espress." a'8 \stemDown d''8[ <f' aes'> d'' ] \stemUp | \stemUp \break
 % 4–7
 \stemDown d''8[ <e' g'> c'' ] \stemUp bes'4\< f''8\! | \stemUp
 f''4\> a'8\! gis'4\< d''8\! | \stemUp
 c''4\> f'8\! \stemDown g'8[\< <bes e'> gis' ]\!) \stemUp | \stemUp
 a'4. r4 r8 | \stemUp \break
 % 8–12
 R2. | \stemUp
 a'4( a'8 \stemDown d''8[ <f' aes'> d'' ] \stemUp | \stemUp
 \stemDown d''8[ <e' g'> c'' ] \stemUp b'!4_\markup\italic "cresc." f''8 | \stemUp
 e''4 a'8 b'!4 c''8) | \stemUp
 a'4. r4 <f' b'! f''>8(\f | \stemUp \break
 % 13–17
 <e' a' e''>4 a'8 b'!4 c''8) | \stemUp
 a'4. r4 <d' f' d''>8(\p | \stemUp
 <c' f' c''>4 f'8 \stemDown g'8[ <bes e'> a' ]) \stemUp | \stemUp
 f'4 r8 r4 r8 | \stemUp
 R2. | \stemUp \pageBreak
 % page 2, system 1: 18–21
 a'4( a'8 \stemDown d''8[ <f' aes'> d'' ] \stemUp | \stemUp
 \stemDown d''8[ <e' g'> c'' ] \stemUp b'!4_\markup\italic "espress."\< f''8\! | \stemUp
 f''4 a'8 gis'4\< d''8\! | \stemUp
 c''4 f'8 \stemDown g'8[\> <bes e'> gis' ] \stemUp | \stemUp \break
 % 22–25
 a'4.\! r4 r8) | \stemUp
 a'4^\markup\italic "sempre legato." a'8 \stemDown d''8[ <f' aes'> d''^^ ] \stemUp | \stemUp
 \stemDown d''8^^[ <e' g'> c'' ] \stemUp b'!4\< f''8\! | \stemUp
 e''4\> a'8 b'!4 c''8\! | \stemUp \break
 % 26–29
 a'4. r4 <f' b'! f''>8\p | \stemUp
 <e' a' e''>4^^ a'8 b'!4 c''8 | \stemUp
 a'4. r4 a'8 | \stemUp
 \stemDown bes'8[^\markup\italic "un poco agitato."\< <cis' e'> a' ]\! \stemUp \stemDown g'8[\> <cis' e'> a' ]\! \stemUp | \stemUp \break
 % 30–34
 \stemDown bes'8[ <cis' e'> a' ] \stemUp \stemDown g'8[ <cis' e'> a' ] \stemUp | \stemUp
 \stemDown bes'8[\< <cis' e'> bes' ] \stemUp \stemDown e''8^^[ <e' g'> d'' ]\! \stemUp | \stemUp
 \set tieWaitForNote = ##t \stemDown cis''8.~[\> <e' g'>16 cis''8~ ] \stemUp \stemDown cis''8[ <e' g'> a' ]\! \stemUp \unset tieWaitForNote | \stemUp
 \stemDown bes'8^^[^\markup\italic "tranquillo." <cis' e'> a' ] \stemUp \stemDown g'8[ <cis' e'> a' ] \stemUp | \stemUp
 \stemDown bes'8^^[ <cis' e'> a' ] \stemUp \stemDown g'8[ <cis' e'> a' ] \stemUp | \stemUp \break
 % 35–38
 \stemDown bes'8[ <cis' e'> bes' ]\< \stemUp \stemDown e''8[\! <e' bes'> d'' ] \stemUp | \stemUp
 \stemDown cis''8[ <e' a'> cis'' ] \stemUp \stemDown e''8[^\markup\italic "accell." <e' b'!> d'' ] \stemUp | \stemUp
 \stemDown cis''8[ <e' a'> cis'' ] \stemUp \stemDown e''8[ <e' gis'> d'' ] \stemUp | \stemUp
 \stemDown cis''8[ <e' g'!> cis'' ] \stemUp \stemDown c''!8[ <es' ges'> c'' ] \stemUp | \stemUp \pageBreak
 % page 3, system 1: 39–43
 \stemDown c''8[^\markup\italic "calmandosi." <d' f'> c'' ] \stemUp \stemDown b'!8[_\markup\italic "dim." <d' f'> b' ] \stemUp | \stemUp
 \stemDown bes'8[^\markup\italic "rit." <des' f'> bes' ] \stemUp \stemDown a'8[ <c' e'> <bes e' g'> ] \stemUp | \stemUp
 << { f'4^\markup\italic "a tempo." r8\pp r4 r8 } \\ { <a c'>8 <a c'>4 r4 r8 } >> | \stemUp
 R2. | \stemUp
 a'4^\markup\italic "tranquillo." a'8\< \stemDown d''8[\! <f' aes'> d'' ] \stemUp | \stemUp \break
 % 44–47: small-note eight-note groups are printed in the original.
 \stemDown d''8[\sf <e' g'> c'' ]
 \stemUp \stemDown \tuplet 8/12 { bes'32(\pp\< \magnifyMusic 0.65 { d''32 f'' a'' g'' f'' d'' bes')\! } } | \stemUp
 a'4\> a'8\! \stemDown \tuplet 8/12 { gis'32(\pp \magnifyMusic 0.65 { b'32 e'' d'' b' gis' d' e') } } | \stemUp
 f'4\< f'8\! \stemDown g'8[ <bes e'> gis' ] \stemUp | \stemUp
 a'4. r4 r8 | \stemUp \break
 % 48–51
 a'4 a'8 \stemDown d''8[ <f' aes'> d'' ] \stemUp | \stemUp
 \stemDown d''8[ <e' g'> c'' ] \stemUp b'!4_\markup\italic "cresc." f''8 | \stemUp
 e''4 a'8 b'!4 c''8 | \stemUp
 a'4 r8 r4 <f' b'! f''>8\f | \stemUp \break
 % 52–56
 <e' a' e''>4 a'8 b'!4 c''8 | \stemUp
 a'4 r8 r4 <d' f' d''>8 | \stemUp
 <c' f' c''>4^\markup\italic "poco riten."\p f'8 g'4 a'8 | \stemUp
 f'4 r8 r4 r8 | \stemUp
 \stemDown f'8[^\markup\italic "a tempo." <a c'> f' ] \stemUp \stemDown fis'8[^\markup\italic "poco" <ais cis'> fis' ] \stemUp | \stemUp \break
 % 57–60
 \stemDown g'8[^\markup\italic "a poco crescendo." <bes des'> g' ] \stemUp \stemDown c''8[ <des' e'> bes' ] \stemUp | \stemUp
 << { aes'4 r8 r4 r8 } \\ { aes'8 <c' es'>4 r8 <c' es'>4 } >> | \stemUp
 \stemDown aes'8[ <c' es'> aes' ] \stemUp \stemDown a'!8[ <cis' e'> a' ] \stemUp | \stemUp
 \stemDown ais'8[ <cis' e'> ais' ] \stemUp \stemDown dis''8[ <e' fis'> cis'' ] \stemUp | \stemUp
 \bar "||" \key b \major \pageBreak
 % page 4, system 1: 61–65
 \stemDown b'8[\f <dis' fis'> b' ] \stemUp \stemDown dis''8[ <dis' fis'> b' ] \stemUp | \stemUp
 \stemDown gis'8[ <b e'> gis' ]\< \stemUp \stemDown ais'8[ <cis' e' fis'> ais' ]\! \stemUp | \stemUp
 \stemDown b'8[\> <dis' fis'> b' ] \stemUp \stemDown dis''8[ <dis' fis'> b' ] \stemUp | \stemUp
 \stemDown gis'8[ <b e'> gis' ] \stemUp \stemDown ais'8[ <e' fis'> ais' ]\! \stemUp | \stemUp
 \stemDown b'8[ <dis' fis'> b' ] \stemUp \stemDown <dis' dis''>8^^[ fisis'\f <cis' cis''> ] \stemUp | \stemUp \break
 % 66–69
 \stemDown <bis bis'>8[^\markup\italic "stretto." gis' <bis bis'> ] \stemUp \stemDown <dis' dis''>8^^[ fisis' <cis' cis''> ] \stemUp | \stemUp
 \stemDown <bis bis'>8[\< gis' <bis bis'> ] \stemUp \stemDown <dis' dis''>8[ fisis' <cis' cis''> ]\! \stemUp | \stemUp
 \stemDown <bis bis'>8[\> gis' bis' ] \stemUp \stemDown <e' dis''>8[^\markup\italic "dolcemente e tranquillo." gis' cis'' ] \stemUp | \stemUp
 \stemDown b'8[ <dis' fis'> b' ] \stemUp \stemDown dis''8[\p <dis' fis'> b' ]\! \stemUp | \stemUp \break
 % 70–74
 \stemDown gis'8[ <b e'> gis' ] \stemUp \stemDown ais'8[ <e' fis'> ais' ] \stemUp | \stemUp
 \stemDown b'8[ <dis' fis'> b' ] \stemUp \stemDown dis''8^^[ <dis' fis'> b' ] \stemUp | \stemUp
 \stemDown gis'8[\< <b e'> gis' ] \stemUp \stemDown ais'8[ <e' fis'> ais' ]\! \stemUp | \stemUp
 \stemDown b'8[\< <e' gis'> b' ] \stemUp \stemDown bis'8[ <e' g'!> bis' ]\! \stemUp | \stemUp
 \stemDown cis''8[\> <e' g'!> cis'' ] \stemUp \stemDown bis'8[ <e' g'> bis' ]\! \stemUp | \stemUp \break
 % 75–78
 \stemDown b'!8[\< <dis' fis'> b' ] \stemUp \stemDown bis'8[ <e' g'!> bis' ]\! \stemUp | \stemUp
 \stemDown cis''8[\> <e' g'!> cis'' ] \stemUp \stemDown bis'8[ <e' g'> bis' ]\! \stemUp | \stemUp
 \stemDown b'!8[ <e' gis'> b' ] \stemUp \stemDown c''!8^^[_\markup\italic "dim." <e' g'!> c'' ] \stemUp | \stemUp
 \stemDown c''!8^^[ <e' g'!> c''^^ ] \stemUp \stemDown c''8^^[ <e' f'!> c'' ] \stemUp | \stemUp \break
 % 79–82
 \stemDown c''!8^^[ <d'! f'!> c''^^ ] \stemUp \stemDown b'8^^[_\markup\italic "rit." <d' f'> b' ] \stemUp | \stemUp
 \stemDown bes'8^^[ <des' f'> bes'^^ ] \stemUp \stemDown a'!8^^[ <c'! e'> <bes e' g'!> ] \stemUp | \stemUp
 \bar "||" \key f \major
 << { f'4^^^\markup\italic "a tempo." r8 r4 r8 } \\ { <a c'>8\pp <a c'>4 r8 <a c'>4\pp } >> | \stemUp
 << { r4 r8 r4 r8 } \\ { r8 <a c'>4 r8 <a c'>4 } >> | \stemUp \pageBreak
 % page 5, system 1: 83–87
 a'4^\markup\italic "molto espress."\< a'8\! \stemDown d''8[ <f' aes'> d''^^ ] \stemUp | \stemUp
 \stemDown d''8^^[ <e' g'> c'' ] \stemUp b'!4\< f''8\! | \stemUp
 f''4\> a'8\! gis'4\< d''8\! | \stemUp
 c''4 f'8 \stemDown g'8[\< <bes e'> gis' ]\! \stemUp | \stemUp
 a'4. r4 r8 | \stemUp \break
 % 88–91
 a'4 a'8 \stemDown d''8[_\markup\italic "cresc." <f' aes'> d'' ] \stemUp | \stemUp
 \stemDown d''8[ <e' g'> c'' ] \stemUp b'!4\< f''8\! | \stemUp
 e''4 a'8 b'!4 c''8 | \stemUp
 a'4 r8 \stemDown \tuplet 7/12 { f''32(\mf bes'' f'' d'' bes' f' g') } | \stemUp \break
 % 92–95
 a'4 a'8\< b'!4 c''8\! | \stemUp
 a'4^\markup\italic "una corda." r8 \stemDown \tuplet 7/12 { bes'32(\pp f'' d'' bes' g' d' e') } | \stemUp
 \stemDown f'8[\< <a c'> f' ]\! \stemUp \stemDown g'8[^\markup\italic "rit." <bes e'> a' ] \stemUp | \stemUp
 \stemDown f'8[ <a c'> ] \stemUp r8 r4^\markup\italic "a tempo." r8 | \stemUp \break
 % 96–100
 \stemDown f'8[\< <a c'> f' ] \stemUp \stemDown ges'8[^\markup\italic "tre corde." <bes des'> ges' ]\! \stemUp | \stemUp
 \stemDown g'!8[\> <bes des'> g' ] \stemUp \stemDown ges'8[ <bes des'> ges' ]\! \stemUp | \stemUp
 \stemDown f'8[ <a c'> ] \stemUp r8 r4 r8 | \stemUp
 \stemDown f'8[\< <a c'> f' ] \stemUp \stemDown ges'8[ <bes des'> ges' ]\! \stemUp | \stemUp
 \stemDown g'!8[\> <bes des'> g' ] \stemUp \stemDown ges'8[ <bes des'> ges' ]\! \stemUp | \stemUp \break
 % 101–106
 \stemDown f'8[^\markup\italic "calando." <a c'> f' ] \stemUp \stemDown g'!8[ <bes e'> a' ] \stemUp | \stemUp
 \stemDown f'8[^\markup\italic "una corda."\< <a c'> f' ] \stemUp \stemDown g'8[ <bes e'> a' ]\! \stemUp | \stemUp
 \stemDown f'8[ <a c'> f' ] \stemUp \stemDown g'8[\ppp <bes e'> c''^^~ ] \stemUp | \stemUp
 <c' f' gis' c''>2. | \stemUp
 <a c' f' a'>2.\arpeggio\ppp~ | \stemUp
 <a c' f' a'>2.^\fermata \bar "|."
}
left = \absolute {
 \clef bass \key f \major \time 6/8
 \set Staff.pedalSustainStyle = #'text
 % page 1: 1–3
 f8^^(\pp^\markup\italic "tranquillo." <a c'> e^^ d^^ <a c'> e^^ |
 f8^^ <a c'> e^^ d^^ <a c'> e^^) |
 f8^^ <a c'> f f <aes b!> f |
 % 4–7
 e8[ <g c'> e] d8 <f bes d'> d |
 c8 <f a c'> c b,! <gis b! f'> b,! |
 c8 <a c' f'> c c <g c'> c |
 f8^^( <a c'> e^^ d^^ <a c'> e^^ |
 % 8–12
 f8^^ <a c'> e^^ d^^ <a c'> e^^) |
 f8^^ <a c'> f f <aes b!> f |
 e8 <g c'> e d <f b!> d |
 e8 <a c'> e e <gis d'> e |
 a,8 <a c'> c e <a c'> <d aes b!> |
 % 13–17
 <e a c'>8 <a c'> e e <gis d'> e |
 a,8 <a c'> e c a, <bes, f bes> |
 <c f a>8 <f a> c c <g c'> c |
 f8^^( <a c'> e^^ d^^ <a c'> e^^ |
 f8^^\pp <a c'> e^^ d^^ <a c'> e^^) |
 % page 2: 18–21
 f8^^ <a c'> f f <aes b!> f |
 e8 <g c'> e d <f bes d'> d |
 c8 <f a c'> c b,! <gis b! f'> b,! |
 c8 <a c' f'> c c <g c'> c |
 % 22–25
 f8^^( <a c'> e^^ d^^ <a c'> e^^) |
 f8^^^\markup\italic "poco cresc." <a c'> f f <aes b!> f |
 e8 <g c'>-. e d <f b!> d |
 e8 <a c'>-. e e <gis d'> e |
 % 26–29
 a,8 <a c'> c e <a c'> <d aes b!> |
 <e a c'>8^\markup\italic "poco rit." <a c'> e e <gis d'> e |
 a,8^\markup\italic "a tempo." <a c'> c e <a c'> f |
 e4 f8 g4 f8 |
 % 30–34
 e4 f8 g4 f8 |
 e4. bes4.^^ |
 a4_\markup\italic "tranquillo." e8 cis4 a,8 |
 e4^^ f8 g4 f8 |
 e4^^ f8 g4 f8 |
 % 35–38
 e4. gis4. |
 a4. gis4._\markup\italic "cresc." |
 a4. b!4. |
 a4. aes4. |
 % page 3: 39–43
 g2. |
 g4. c4. |
 f4 e8 d8^^ <a c'> e^^ |
 f8^^ <a c'> e^^ d^^ <a c'> e^^ |
 f8^^ <a c'> f f <aes b!> f |
 % 44–47
 e8 <g c'> e d <f bes d'> d |
 c8 <f a c'> c d <gis b! f'> b,! |
 c8 <a c' f'> c c <g c'> c |
 f8^^ <a c'> e^^ d^^ <a c'> e^^ |
 % 48–51
 f8^^ <a c'> f f <aes b!> f |
 e8 <g c'> e d <f b!> d |
 e8 <a c'> e e <gis d'> e |
 a,8 <a c'> c e <a c'> <d aes b!> |
 % 52–56
 <e a c'>8 <a c'> e e <gis d'> e |
 a8 <c' e'> e a, <e a> <bes, f g> |
 <c f a>8 <f a> c c <e bes> c |
 f8^^ <a c'> e^^ d^^ <a c'> e^^ |
 f4.^^ e4. |
 % 57–60
 es4. es,4.^\markup\italic "un poco agitato." |
 aes,4 g8 f4 g8 |
 aes4. f4. |
 fis4. fis,4. |
 \bar "||" \key b \major
 % page 4: 61–65
 b,4. <b, fis>4. |
 b,4. fis4. |
 <b, fis>4.^^ b,4.~ |
 <b, e>4. cis4. |
 b,4. <ais, dis ais>4. |
 % 66–69
 <a,! dis a!>4.^^ <ais, dis ais>4.^^ |
 <a,! dis a!>4.^^ <ais, dis ais>4.^^ |
 <a,! dis a!>4.^^ <ais, fis>4.^^ |
 <b, fis>4.^^( <b, fis>4.)( |
 % 70–74
 <b, e>4.) cis4. |
 << { \voiceTwo b,4. b,4.~ | b,2. } \\ { \voiceOne s4. fis4. | e4. cis4. } >> \oneVoice |
 b,4. a4.^^ |
 a!4.^^ ais4. |
 % 75–78
 b4.^^ a4. |
 a!4. ais4. |
 b4. a4.^^ |
 a!4.^^ gis4.^^ |
 % 79–82
 g!4.( g4.) |
 g!4.^^ <c! g!>4.^^ |
 \bar "||" \key f \major
 f4( e8 d4 e8 |
 f4 e8 d4 e8) |
 % page 5: 83–87
 f8 <a c'> f f <aes b!> f |
 e8 <g c'> e d <f bes d'> d |
 c8 <f a c'> c b,! <gis b! f'> b,! |
 c8 <a c' f'> c c <g c'> c |
 f8^^ <a c'> e^^ d^^ <a c'> e^^ |
 % 88–91
 f8^^ <a c'> f f <aes b!> f |
 e8 <g c'> e d <f b!> d |
 e8 <a c'> e e <gis d'> e |
 a,8 <a c'> e d <f bes d'> d |
 % 92–95
 e8 <a c' e'> e e <gis d'> e |
 a,8 <a c'> a, bes, <f g bes> d |
 c4 c8 c <g c'> c |
 f4 e8 d8 <a c'> e |
 % 96–100
 f4.^^ e4.^^ |
 es4. e!4. |
 f4 e8 d8 <a c'> e^^ |
 f4.^^ e4. |
 es4. e!4. |
 % 101–106
 f4. c4. |
 f4. c4. |
 f4. c4. |
 <f, c>2.^^ |
 <f, c f>2.\arpeggio~ |
 <f, c f>2.\fermata \bar "|."
}
% These quarter-note stems share heads with accompaniment eighths in the print.
% Keeping an explicit voice retains their duration rather than shortening them.
melodyHolds = \absolute {
 % 1–17
 s2. | s2. | s4. d''4 s8 |
 d''4 s2 | s2. | s4. g'4 s8 | s2. |
 s2. | s4. d''4 s8 | d''4 s2 | s2. | s2. |
 s2. | s2. | s4. g'4 s8 | s2. | s2. |
 % 18–38
 s4. d''4 s8 | d''4 s2 | s2. | s4. g'4 s8 |
 s2. | s4. d''4 s8 | d''4 s2 | s2. |
 s2. | s2. | s2. | bes'4 s8 g'4 s8 |
 bes'4 s8 g'4 s8 | bes'4 s8 e''4 s8 |
 cis''4. cis''4 s8 |
 bes'4 s8 g'4 s8 | bes'4 s8 g'4 s8 |
 bes'4 s8 e''4 s8 | cis''4 s8 e''4 s8 |
 cis''4 s8 e''4 s8 | cis''4 s8 c''4 s8 |
 % 39–60
 c''4 s8 b'4 s8 | bes'4 s8 a'4 s8 | s2. | s2. | s4. d''4 s8 |
 d''4 s2 | s2. | s4. g'4 s8 | s2. |
 s4. d''4 s8 | d''4 s2 | s2. | s2. |
 s2. | s2. | s2. | s2. | f'4 s8 fis'4 s8 |
 g'4 s8 c''4 s8 | s2. | aes'4 s8 a'4 s8 | ais'4 s8 dis''4 s8 |
 % 61–82
 b'4 s8 dis''4 s8 | gis'4 s8 ais'4 s8 |
 b'4 s8 dis''4 s8 | gis'4 s8 ais'4 s8 | b'4 s8 dis''4 s8 |
 bis'4 s8 dis''4 s8 | bis'4 s8 dis''4 s8 | bis'4 s8 dis''4 s8 | b'4 s8 dis''4 s8 |
 gis'4 s8 ais'4 s8 | b'4 s8 dis''4 s8 | gis'4 s8 ais'4 s8 |
 b'4 s8 bis'4 s8 | cis''4 s8 bis'4 s8 |
 b'4 s8 bis'4 s8 | cis''4 s8 bis'4 s8 | b'4 s8 c''4 s8 | c''4 s8 c''4 s8 |
 c''4 s8 b'4 s8 | bes'4 s8 a'4 s8 | s2. | s2. |
 % 83–106
 s4. d''4 s8 | d''4 s2 | s2. | s4. g'4 s8 | s2. |
 s4. d''4 s8 | d''4 s2 | s2. | s2. |
 s2. | s2. | f'4 s8 g'4 s8 | f'4 s2 |
 f'4 s8 ges'4 s8 | g'4 s8 ges'4 s8 | f'4 s2 | f'4 s8 ges'4 s8 | g'4 s8 ges'4 s8 |
 f'4 s8 g'4 s8 | f'4 s8 g'4 s8 | f'4 s8 g'4 s8 | s2. | s2. | s2. |
}
pedals = {
 \set Staff.pedalSustainStyle = #'text
 % 1
 s1*0\sustainOn s8 s8 s8 s8 s8 s8 s1*0\sustainOff |
 % 2
 s1*0\sustainOn s8 s8 s8 s8 s8 s8 s1*0\sustainOff |
 % 3
 s1*0\sustainOn s8 s8 s8 s1*0\sustainOff s8 s8 s8 |
 % 4
 s8 s8 s8 s1*0\sustainOn s8 s8 s8 s1*0\sustainOff |
 % 5
 s8 s8 s8 s8 s8 s8 |
 % 6
 s1*0\sustainOn s8 s8 s8 s8 s8 s8 s1*0\sustainOff |
 % 7
 s1*0\sustainOn s8 s8 s8 s8 s8 s8 s1*0\sustainOff |
 % 8
 s1*0\sustainOn s8 s8 s8 s8 s8 s8 s1*0\sustainOff |
 % 9
 s8 s8 s8 s8 s8 s8 |
 % 10
 s8 s8 s8 s8 s8 s8 |
 % 11
 s8 s8 s8 s8 s8 s8 |
 % 12
 s1*0\sustainOn s8 s8 s8 s8 s1*0\sustainOff s8 s8 |
 % 13
 s1*0\sustainOn s8 s8 s1*0\sustainOff s8 s8 s8 s8 |
 % 14
 s1*0\sustainOn s8 s8 s8 s8 s8 s1*0\sustainOff s8 |
 % 15
 s1*0\sustainOn s8 s8 s8 s1*0\sustainOff s8 s8 s8 |
 % 16
 s1*0\sustainOn s8 s8 s8 s8 s8 s8 s1*0\sustainOff |
 % 17
 s1*0\sustainOn s8 s8 s8 s8 s8 s8 s1*0\sustainOff |
 % 18
 s8 s8 s8 s8 s8 s8 |
 % 19
 s8 s8 s8 s1*0\sustainOn s8 s8 s8 s1*0\sustainOff |
 % 20
 s1*0\sustainOn s8 s8 s8 s1*0\sustainOff s1*0\sustainOn s8 s8 s8 s1*0\sustainOff |
 % 21
 s1*0\sustainOn s8 s8 s8 s1*0\sustainOff s8 s8 s8 |
 % 22
 s8 s8 s8 s8 s8 s8 |
 % 23
 s8 s8 s8 s8 s8 s8 |
 % 24
 s8 s8 s8 s8 s8 s8 |
 % 25
 s8 s8 s8 s8 s8 s8 |
 % 26
 s1*0\sustainOn s8 s8 s8 s8 s8 s8 s1*0\sustainOff |
 % 27
 s1*0\sustainOn s8 s8 s1*0\sustainOff s8 s8 s8 s8 |
 % 28
 s1*0\sustainOn s8 s8 s8 s8 s8 s1*0\sustainOff s8 |
 % 29
 s8 s8 s8 s8 s8 s8 |
 % 30
 s8 s8 s8 s8 s8 s8 |
 % 31
 s8 s8 s8 s8 s8 s8 |
 % 32
 s8 s8 s8 s8 s8 s8 |
 % 33
 s8 s8 s8 s8 s8 s8 |
 % 34
 s8 s8 s8 s8 s8 s8 |
 % 35
 s8 s8 s8 s8 s8 s8 |
 % 36
 s8 s8 s8 s8 s8 s8 |
 % 37
 s8 s8 s8 s8 s8 s8 |
 % 38
 s8 s8 s8 s8 s8 s8 |
 % 39
 s1*0\sustainOn s8 s8 s8 s8 s8 s1*0\sustainOff s8 |
 % 40
 s8 s8 s8 s8 s8 s8 |
 % 41
 s1*0\sustainOn s8 s8 s8 s8 s8 s8 s1*0\sustainOff |
 % 42
 s1*0\sustainOn s8 s8 s8 s8 s8 s8 s1*0\sustainOff |
 % 43
 s1*0\sustainOn s8 s8 s8 s1*0\sustainOff s8 s8 s8 |
 % 44
 s8 s8 s8 s1*0\sustainOn s8 s8 s8 s1*0\sustainOff |
 % 45
 s1*0\sustainOn s8 s8 s8 s1*0\sustainOff s1*0\sustainOn s8 s8 s8 s1*0\sustainOff |
 % 46
 s1*0\sustainOn s8 s8 s8 s8 s8 s8 s1*0\sustainOff |
 % 47
 s8 s8 s8 s8 s8 s8 |
 % 48
 s8 s8 s8 s8 s8 s8 |
 % 49
 s8 s8 s8 s8 s8 s8 |
 % 50
 s8 s8 s8 s8 s8 s8 |
 % 51
 s1*0\sustainOn s8 s8 s8 s8 s1*0\sustainOff s8 s8 |
 % 52
 s8 s8 s8 s8 s8 s8 |
 % 53
 s8 s8 s8 s8 s8 s8 |
 % 54
 s8 s8 s8 s8 s8 s8 |
 % 55
 s8 s8 s8 s8 s8 s8 |
 % 56
 s8 s8 s8 s8 s8 s8 |
 % 57
 s1*0\sustainOn s8 s8 s8 s8 s8 s8 s1*0\sustainOff |
 % 58
 s8 s8 s8 s8 s8 s8 |
 % 59
 s8 s8 s8 s8 s8 s8 |
 % 60
 s8 s8 s8 s8 s8 s8 |
 % 61
 s1*0\sustainOn s8 s8 s8 s8 s8 s8 s1*0\sustainOff |
 % 62
 s8 s8 s8 s8 s8 s8 |
 % 63
 s1*0\sustainOn s8 s8 s8 s1*0\sustainOff s8 s8 s8 |
 % 64
 s8 s8 s8 s8 s8 s8 |
 % 65
 s8 s8 s8 s8 s8 s8 |
 % 66
 s8 s8 s8 s8 s8 s8 |
 % 67
 s8 s8 s8 s8 s8 s8 |
 % 68
 s8 s8 s8 s1*0\sustainOn s8 s8 s1*0\sustainOff s8 |
 % 69
 s1*0\sustainOn s8 s8 s8 s8 s8 s8 s1*0\sustainOff |
 % 70
 s8 s8 s8 s8 s8 s8 |
 % 71
 s1*0\sustainOn s8 s8 s8 s8 s8 s8 s1*0\sustainOff |
 % 72
 s8 s8 s8 s8 s8 s8 |
 % 73
 s8 s8 s8 s8 s8 s8 |
 % 74
 s8 s8 s8 s8 s8 s8 |
 % 75
 s8 s8 s8 s8 s8 s8 |
 % 76
 s8 s8 s8 s8 s8 s8 |
 % 77
 s8 s8 s8 s8 s8 s8 |
 % 78
 s8 s8 s8 s8 s8 s8 |
 % 79
 s1*0\sustainOn s8 s8 s8 s8 s8 s8 s1*0\sustainOff |
 % 80
 s8 s8 s8 s1*0\sustainOn s8 s8 s1*0\sustainOff s8 |
 % 81
 s1*0\sustainOn s8 s8 s8 s8 s8 s8 |
 % 82
 s8 s8 s8 s8 s8 s8 |
 % 83
 s8 s8 s8 s8 s8 s8 |
 % 84
 s8 s8 s8 s1*0\sustainOn s8 s8 s8 s1*0\sustainOff |
 % 85
 s1*0\sustainOn s8 s8 s8 s1*0\sustainOff s1*0\sustainOn s8 s8 s8 s1*0\sustainOff |
 % 86
 s1*0\sustainOn s8 s8 s8 s1*0\sustainOff s8 s8 s8 |
 % 87
 s1*0\sustainOn s8 s8 s8 s8 s8 s8 s1*0\sustainOff |
 % 88
 s8 s8 s8 s8 s8 s8 |
 % 89
 s8 s8 s8 s8 s8 s8 |
 % 90
 s8 s8 s8 s8 s8 s8 |
 % 91
 s1*0\sustainOn s8 s8 s1*0\sustainOff s8 s1*0\sustainOn s8 s8 s8 s1*0\sustainOff |
 % 92
 s1*0\sustainOn s8 s8 s1*0\sustainOff s8 s8 s8 s8 |
 % 93
 s1*0\sustainOn s8 s8 s1*0\sustainOff s8 s1*0\sustainOn s8 s8 s8 s1*0\sustainOff |
 % 94
 s8 s8 s8 s8 s8 s8 |
 % 95
 s8 s8 s8 s1*0\sustainOn s8 s8 s1*0\sustainOff s8 |
 % 96
 s8 s8 s8 s8 s8 s8 |
 % 97
 s1*0\sustainOn s8 s8 s8 s1*0\sustainOff s8 s8 s8 |
 % 98
 s1*0\sustainOn s8 s8 s8 s8 s8 s1*0\sustainOff s8 |
 % 99
 s8 s8 s8 s8 s8 s8 |
 % 100
 s8 s8 s8 s8 s8 s8 |
 % 101
 s8 s8 s8 s1*0\sustainOn s8 s8 s1*0\sustainOff s8 |
 % 102
 s8 s8 s8 s1*0\sustainOn s8 s8 s1*0\sustainOff s8 |
 % 103
 s8 s8 s8 s1*0\sustainOn s8 s8 s8 |
 % 104
 s8 s8 s8 s8 s8 s8 s1*0\sustainOff |
 % 105
 s1*0\sustainOn s8 s8 s8 s8 s8 s8 |
 % 106
 s8 s8 s8 s8 s8 s8\sustainOff |
}
\score {
 \new PianoStaff \with { instrumentName = "Piano" connectArpeggios = ##t } <<
  \new Staff = "upper" <<
   \new Voice { \voiceTwo \right }
   \new Voice { \voiceOne \melodyHolds }
  >>
  \new Staff = "lower" << \new Voice { \left } \new NullVoice { \pedals } >>
 >>
 \layout { }
}
