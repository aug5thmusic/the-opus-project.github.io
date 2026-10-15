\version "2.24.3"
% Independently entered visually from Heugel H.4875 (1872), IMSLP48626.
% Complete printed pages 1–5. No existing encoding used.
\header {
 title = "Le sommeil de l'enfant"
 subtitle = "Berceuse"
 composer = "Teresa Carreño"
 opus = "Op. 35"
 dedication = "À mon père"
 tagline = ##f
}
\paper { #(set-paper-size "a4") }
right = \absolute {
 \clef treble \key f \major \time 6/8
 \slurUp \tieUp \tupletUp
 \mergeDifferentlyDottedOn \mergeDifferentlyHeadedOn
 \tempo "Allegretto quasi andante" 4. = 48
 % page 1, system 1: 1–3
 R2. | R2. |
 a'4( ^\markup\italic "con espress." a'8 d''8[ <f' aes'> d''] | \break
 % 4–7
 d''8[ <e' g'> c''] bes'4\< f''8\! |
 f''4\> a'8\! gis'4\< d''8\! |
 c''4\> f'8\! g'8[\< <bes e'> gis']\!) |
 a'4. r4 r8 | \break
 % 8–12
 R2. |
 a'4( a'8 d''8[ <f' aes'> d''] |
 d''8[ <e' g'> c''] b'!4_\markup\italic "cresc." f''8 |
 e''4 a'8 b'!4 c''8) |
 a'4. r4 <f' b'! f''>8(\f | \break
 % 13–17
 <e' a' e''>4 a'8 b'!4 c''8) |
 a'4. r4 <d' f' d''>8(\p |
 <c' f' c''>4 f'8 g'8[ <bes e'> a']) |
 f'4 r8 r4 r8 |
 R2. | \pageBreak
 % page 2, system 1: 18–21
 a'4( a'8 d''8[ <f' aes'> d''] |
 d''8[ <e' g'> c''] b'!4_\markup\italic "espress."\< f''8\! |
 f''4 a'8 gis'4\< d''8\! |
 c''4 f'8 g'8[\> <bes e'> gis'] | \break
 % 22–25
 a'4.\! r4 r8) |
 a'4(^\markup\italic "sempre legato." a'8 d''8[ <f' aes'> d''^^] |
 d''8^[ <e' g'> c''] b'!4\< f''8\! |
 e''4\> a'8 b'!4 c''8\!) | \break
 % 26–29
 a'4. r4 <f' b'! f''>8\p |
 <e' a' e''>4^^ a'8 b'!4 c''8 |
 a'4. r4 a'8 |
 bes'8[^\markup\italic "un poco agitato."\< <cis' e'> a']\! g'8[\> <bes d'> a']\! | \break
 % 30–34
 bes'8[ <cis' e'> a'] g'8[ <bes d'> a'] |
 bes'8[\< <cis' e'> bes'] e''8^^[ <e' g'> d'']\! |
 \set tieWaitForNote = ##t cis''8.(~[\> <e' g'>16 cis''8~] cis''8[ <e' g'> d''])\! \unset tieWaitForNote |
 bes'8^^[^\markup\italic "tranquillo." <cis' e'> a'] g'8[ <bes d'> a'] |
 bes'8^^[ <cis' e'> a'] g'8[ <bes d'> a'] | \break
 % 35–38
 bes'8[ <cis' e'> bes']\< e''8[\! <e' bes'> d''] |
 cis''8[ <e' a'> cis''] e''8[^\markup\italic "accell." <e' b'!> d''] |
 cis''8[ <e' a'> cis''] e''8[ <e' gis'> d''] |
 cis''8[ <e' g'!> c''!] c''8[ <es' ges'> c''] | \pageBreak
 % page 3, system 1: 39–43
 c''8[^\markup\italic "calmandosi." <d' f'> c''] b'!8[_\markup\italic "dim." <d' f'> b'] |
 bes'8[^\markup\italic "rit." <des' f'> bes'] a'8[ <c' e'> <bes e' g'>] |
 << { f'4^\markup\italic "a tempo." r8\pp r4 r8 } \\ { <a c'>8 <a c'>4 r4 r8 } >> |
 R2. |
 a'4^\markup\italic "tranquillo." a'8\< d''8[\! <f' aes'> d''] | \break
 % 44–47: small-note eight-note groups are printed in the original.
 d''8[\sf <e' g'> c'']
 \tuplet 8/12 { bes'32(\pp\< \magnifyMusic 0.65 { d''32 f'' a'' g'' f'' d'' bes')\! } } |
 a'4\> a'8\! \tuplet 8/12 { gis'32(\pp \magnifyMusic 0.65 { b'32 e'' d'' b' gis' d' e') } } |
 f'4\< f'8\! g'8[ <bes e'> gis'] |
 a'4. r4 r8 | \break
 % 48–51
 a'4 a'8 d''8[ <f' aes'> d''] |
 d''8[ <e' g'> c''] b'!4_\markup\italic "cresc." f''8 |
 e''4 a'8 b'!4 c''8 |
 a'4 r8 r4 <f' b'! f''>8\f | \break
 % 52–56
 <e' a' e''>4 a'8 b'!4 c''8 |
 a'4 r8 r4 <d' f' d''>8 |
 <c' f' c''>4^\markup\italic "poco riten."\p f'8 g'4 a'8 |
 f'4 r8 r4 r8 |
 f'8[^\markup\italic "a tempo." <a c'> f'] fis'8[ <ais cis'> fis'] | \break
 % 57–60
 g'8[^\markup\italic "poco a poco crescendo." <bes des'> g'] c''8[ <des' e'> bes'] |
 << { aes'4 r8 r4 r8 } \\ { r8 <c' es'>4 r8 <c' es'>4 } >> |
 aes'8[ <c' es'> aes'] a'!8[ <cis' e'> a'] |
 ais'8[ <cis' e'> ais'] dis''8[ <eis' g'> cis''] |
 \bar "||" \key e \major \pageBreak
 % page 4, system 1: 61–65
 b'8[\f <dis' fis'> b'] dis''8[ <dis' fis'> b'] |
 gis'8[ <b e'> gis']\< a'8[ <cis' e'> a']\! |
 b'8[\> <dis' fis'> b'] dis''8[ <dis' fis'> b'] |
 gis'8[ <b e'> gis'] a'8[ <e' fis'> a']\! |
 b'8[ <dis' fis'> b'] <dis' dis''>8^^[ fisis'\f <cis' cis''>] | \break
 % 66–69
 <bis bis'>8[^\markup\italic "stretto." gis' <bis bis'>] <dis' dis''>8^^[ fisis' <cis' cis''>] |
 <bis bis'>8[\< gis' <bis bis'>] <dis' dis''>8[ fisis' <cis' cis''>]\! |
 <bis bis'>8[\> gis' bis'] <e' dis''>8[^\markup\italic "dolcemente e tranquillo." gis' cis''] |
 b'8[ <dis' fis'> b'] dis''8[\p <dis' fis'> b']\! | \break
 % 70–74
 gis'8[ <b e'> gis'] a'8[ <e' fis'> a'] |
 b'8[ <dis' fis'> b'] dis''8^^[ <dis' fis'> b'] |
 gis'8[\< <b e'> gis'] a'8[ <e' fis'> a']\! |
 b'8[\< <e' gis'> b'] bis'8[ <e' g'!> bis']\! |
 cis''8[\> <e' g'!> cis''] bis'8[ <e' gis'> bis']\! | \break
 % 75–78
 b'!8[\< <dis' fis'> b'] bis'8[ <e' g'!> bis']\! |
 cis''8[\> <e' g'!> cis''] bis'8[ <e' gis'> bis']\! |
 b'!8[ <e' gis'> b'] c''!8^^[_\markup\italic "dim." <e' g'!> c''] |
 c''!8^^[ <e' g'!> c''^^] c''8^^[ <e' f'!> c''] | \break
 % 79–82
 cis''!8^^[ <d'! fis'> cis''^^] b'8^^[_\markup\italic "rit." <d'! fis'> b'] |
 bes'8^^[ <des' f'> bes'^^] a'!8^^[ <bes e'> <bes es' g'>] |
 \bar "||" \key f \major
 << { f'4^^ r8 r4^\markup\italic "a tempo." r8 } \\ { <a c'>8\pp <a c'>4 r8 <a c'>4\pp } >> |
 << { r4 r8 r4 r8 } \\ { r8 <a c'>4 r8 <a c'>4 } >> | \pageBreak
 % page 5, system 1: 83–87
 a'4^\markup\italic "molto espress."\< a'8\! d''8[ <f' aes'> d''^^] |
 d''8^^[ <e' g'> c''] b'!4\< f''8\! |
 f''4\> a'8\! gis'4 d''8 |
 c''4 f'8 g'8[\< <bes e'> gis']\! |
 a'4. r4 r8 | \break
 % 88–91
 a'4 a'8 d''8[_\markup\italic "cresc." <f' aes'> d''] |
 d''8[ <e' g'> c''] b'!4\< f''8\! |
 e''4 a'8 b'!4 c''8 |
 a'4 r8 \tuplet 7/12 { f''32(\mf a'' f'' d'' b' f' g') } | \break
 % 92–95
 a'4 a'8\< b'!4 c''8\! |
 a'4^\markup\italic "una corda." r8 \tuplet 7/12 { b'32(\pp f'' d'' b' g' d' e') } |
 f'8[\< <a c'> f']\! g'8[^\markup\italic "rit." <bes e'> a'] |
 f'8[ <a c'>] r8 r4^\markup\italic "a tempo." r8 | \break
 % 96–100
 f'8[ <a c'> f']\< ges'8[^\markup\italic "tre corde." <bes des'> ges']\! |
 g'!8[\> <bes des'> g'] ges'8[ <bes des'> ges']\! |
 f'8[ <a c'>] r8 r4 r8 |
 f'8[\< <a c'> f'] ges'8[ <bes des'> ges']\! |
 g'!8[\> <bes des'> g'] ges'8[ <bes des'> ges']\! | \break
 % 101–106
 f'8[^\markup\italic "calando." <a c'> f'] g'!8[ <bes e'> a'] |
 f'8[^\markup\italic "una corda." <a c'> f'] g'8[ <bes e'> a'] |
 f'8[ <a c'> f'] g'8[\ppp <bes e'> c''^^~] |
 <c' f' gis' c''>2. |
 <a c' f' a'>2.\arpeggio\ppp~ |
 <a c' f' a'>2.^\fermata \bar "|."
}
left = \absolute {
 \clef bass \key f \major \time 6/8
 \set Staff.pedalSustainStyle = #'text
 % page 1: 1–3
 f8^^(\pp^\markup\italic "tranquillo."\sustainOn <a c'> e^^ d^^ <a c'> e^^\sustainOff |
 f8^^\sustainOn <a c'> e^^ d^^ <a c'> e^^)\sustainOff |
 f8^^\sustainOn <a c'> f f\sustainOff <aes b!> f |
 % 4–7
 e8[ <g c'> e] d8\sustainOn <f bes d'> d\sustainOff |
 c8 <f a c'> c b,! <gis b! e'> b,! |
 c8\sustainOn <a c' e'> c c <g c'> c\sustainOff |
 f8^^(\sustainOn <a c'> e^^ d^^ <a c'> e^^)\sustainOff |
 % 8–12
 f8^^(\sustainOn <a c'> e^^ d^^ <a c'> e^^)\sustainOff |
 f8^^ <a c'> f f <aes b!> f |
 e8 <g c'> e d <f b!> d |
 e8 <a c'> e e <gis d'> e |
 a,8\sustainOn <a c'> c e <a c'>\sustainOff <d aes b!> |
 % 13–17
 <e a c'>8\sustainOn <a c'> e\sustainOff e <gis d'> e |
 a,8\sustainOn <a c'> e c a, <bes, f bes>\sustainOff |
 <c f a>8\sustainOn <f a> c\sustainOff c <g c'> c |
 f8^^(\sustainOn <a c'> e^^ d^^ <a c'> e^^\sustainOff |
 f8^^\pp\sustainOn <a c'> e^^ d^^ <a c'> e^^)\sustainOff |
 % page 2: 18–21
 f8^^ <a c'> f f <aes b!> f |
 e8 <g c'> e d\sustainOn <f bes d'> d\sustainOff |
 c8\sustainOn <f a c'> c\sustainOff b,!\sustainOn <gis b! e'> b,!\sustainOff |
 c8\sustainOn <a c' e'> c\sustainOff c <g c'> c |
 % 22–25
 f8^^( <a c'> e^^ d^^ <a c'> e^^) |
 f8^^^\markup\italic "poco cresc." <a c'> f f <aes b!> f |
 e8 <g c'>-. e d <f b!> d |
 e8 <a c'>-. e e <gis d'> e |
 % 26–29
 a,8\sustainOn <a c'> c e <a c'> <d aes b!>\sustainOff |
 <e a c'>8^\markup\italic "poco rit."\sustainOn <a c'> e\sustainOff e <gis d'> e |
 a,8^\markup\italic "a tempo."\sustainOn <a c'> c e <a c'> f\sustainOff |
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
 \after 8*5 \sustainOff g2.\sustainOn |
 g4. c4. |
 f4\sustainOn e8 d8^^ <a c'> e^^\sustainOff |
 f8^^\sustainOn <a c'> e^^ d^^ <a c'> e^^ |
 f8^^\sustainOn <a c'> f\sustainOff f <aes b!> f |
 % 44–47
 e8 <g c'> e d\sustainOn <f bes d'> d\sustainOff |
 c8\sustainOn <f a c'> c\sustainOff d\sustainOn <gis b! e'> b,!\sustainOff |
 c8\sustainOn <a c' e'> c c <g c'> c |
 f8^^ <a c'> e^^ d^^ <a c'> e^^ |
 % 48–51
 f8^^ <a c'> f f <aes b!> f |
 e8 <g c'> e d <f b!> d |
 e8 <a c'> e e <gis d'> e |
 a,8\sustainOn <a c'> c e <a c'> <d aes b!>\sustainOff |
 % 52–56
 <e a c'>8 <a c'> e e <gis d'> e |
 a8 <c' e'> e a, <e a> <bes f g> |
 <c f a>8 <f a> c c <g c'> c |
 f8^^ <a c'> e^^ d^^ <a c'> e^^ |
 f4.^^ e4. |
 % 57–60
 es4.\sustainOn es,4.\sustainOff |
 aes,4^\markup\italic "un poco agitato." f8 e4 f8 |
 bes4. a4. |
 fis4. fis,4. |
 \bar "||" \key e \major
 % page 4: 61–65
 b,4.\sustainOn <b, fis>4.\sustainOff |
 b,4. fis4. |
 <b, fis>4.^^\sustainOn b,4.(\sustainOff |
 <b, e>4.) cis4. |
 a,4. <gis, dis b>4. |
 % 66–69
 <a, dis a!>4.^^ <ais, dis ais>4.^^ |
 <a, dis a!>4.^^ <ais, dis ais>4.^^ |
 <a, dis a!>4.^^ \after 4 \sustainOff <gis, fis>4.^^\sustainOn |
 <b, fis>4.^^(\sustainOn <b, fis>4.)(\sustainOff |
 % 70–74
 <b, e>4.) cis4. |
 b,4.\sustainOn <b, fis>4.(\sustainOff |
 <b, e>4.) cis4. |
 b,4. a4.^^ |
 a!4.^^ ais4. |
 % 75–78
 b4.^^ a4. |
 a!4. ais4. |
 b4. a4.^^ |
 a!4.^^ g4.^^ |
 % 79–82
 g!4.(\sustainOn g4.)\sustainOff |
 g!4.^^ \after 4 \sustainOff <c! g!>4.^^\sustainOn |
 \bar "||" \key f \major
 f4(\sustainOn e8 d4 e8 |
 f4 e8 d4 e8) |
 % page 5: 83–87
 f8 <a c'> f f <aes b!> f |
 e8 <g c'> e d\sustainOn <f bes d'> d\sustainOff |
 c8\sustainOn <f a c'> c\sustainOff b,!\sustainOn <gis b! e'> b,!\sustainOff |
 c8\sustainOn <a c' e'> c\sustainOff c <g c'> c |
 f8^^\sustainOn <a c'> e^^ d^^ <a c'> e^^\sustainOff |
 % 88–91
 f8^^ <a c'> f f <aes b!> f |
 e8 <g c'> e d <f b!> d |
 e8 <a c'> e e <gis d'> e |
 a,8\sustainOn <a c'> e\sustainOff d\sustainOn <f bes d'> d\sustainOff |
 % 92–95
 e8\sustainOn <a c' e'> e\sustainOff e <gis d'> e |
 a,8\sustainOn <a c'> a,\sustainOff bes,\sustainOn <f ges bes> d\sustainOff |
 c4 c8 c <g c'> c |
 f4 e8 d8\sustainOn <a c'> e\sustainOff |
 % 96–100
 f4.^^ e4.^^ |
 es4.\sustainOn e!4.\sustainOff |
 f4\sustainOn e8 d8 <a c'> e^^\sustainOff |
 f4.^^ e4. |
 es4. e!4. |
 % 101–106
 f4. \after 4 \sustainOff c4.\sustainOn |
 f4. \after 4 \sustainOff c4.\sustainOn |
 f4. c4.\sustainOn |
 <f, c>2.^^\sustainOff |
 <f, c f>2.\arpeggio\sustainOn~ |
 <f, c f>2.\fermata\sustainOff \bar "|."
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
 cis''4.~ cis''4 s8 |
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
 b'4 s8 dis''4 s8 | gis'4 s8 a'4 s8 |
 b'4 s8 dis''4 s8 | gis'4 s8 a'4 s8 | b'4 s8 dis''4 s8 |
 bis'4 s8 dis''4 s8 | bis'4 s8 dis''4 s8 | bis'4 s8 dis''4 s8 | b'4 s8 dis''4 s8 |
 gis'4 s8 a'4 s8 | b'4 s8 dis''4 s8 | gis'4 s8 a'4 s8 |
 b'4 s8 bis'4 s8 | cis''4 s8 bis'4 s8 |
 b'4 s8 bis'4 s8 | cis''4 s8 bis'4 s8 | b'4 s8 c''4 s8 | c''4 s8 c''4 s8 |
 cis''4 s8 b'4 s8 | bes'4 s8 a'4 s8 | s2. | s2. |
 % 83–106
 s4. d''4 s8 | d''4 s2 | s2. | s4. g'4 s8 | s2. |
 s4. d''4 s8 | d''4 s2 | s2. | s2. |
 s2. | s2. | f'4 s8 g'4 s8 | f'4 s2 |
 f'4 s8 ges'4 s8 | g'4 s8 ges'4 s8 | f'4 s2 | f'4 s8 ges'4 s8 | g'4 s8 ges'4 s8 |
 f'4 s8 g'4 s8 | f'4 s8 g'4 s8 | f'4 s8 g'4 s8 | s2. | s2. | s2. |
}
\score {
 \new PianoStaff \with { instrumentName = "Piano" connectArpeggios = ##t } <<
  \new Staff = "upper" <<
   \new Voice { \voiceTwo \right }
   \new Voice { \voiceOne \melodyHolds }
  >>
  \new Staff = "lower" { \left }
 >>
 \layout { }
}
