\version "2.24.3"

% LilyPond 2.24 requires a Moment; 2.26 requires a rational measure length.
% Query the property's type so this downloadable file works with either.
#(define (opus-measure-length fraction)
   (if ((object-property 'measureLength 'translation-type?) fraction)
       fraction
       (ly:make-moment (numerator fraction) (denominator fraction))))
\header {
  title = "Étude No. 4"
  subtitle = "Pour les batteries avec une partie soutenue"
  composer = "Louise Farrenc"
  opus = "Op. 50, No. 4"
  tagline = ##f
}
#(set-default-paper-size "a3")
#(set-global-staff-size 16)
\paper { top-margin = 10\mm bottom-margin = 10\mm left-margin = 10\mm right-margin = 10\mm ragged-last-bottom = ##f }

% Source: IMSLP file 511615, PDF page 6, printed page 5.
% Re-encoded from the printed scan. This is an agent draft, not verified.

global = { \key g \major \time 6/8 }

rightHand = \fixed c' {
  \global \tempo "Poco Allegro"
  << { b4.-4 c'4. }
     \\ { b16\p_\markup { \italic "e molto legato." } g e g e g c' a e a e a } >> |
  << { b4.-4 a4.-5 }
     \\ { b16 g e g e g a fis cis fis cis fis } >> |
  << { g4. a4. }
     \\ { g16 e a, e a, e a e b, e b, e } >> |
  << { g4.-4 s4. }
     \\ { g16 e a, e a, e fis^3 cis a, cis fis b } >> | \break
  b4.-3 \acciaccatura d'8 c'4.\mf |
  b4. a4. |
  g4.-1 fis4.-3 |
  \set Timing.measureLength = #(opus-measure-length 1/2)
  e4.-2 r8 \bar ":|:"
  \set Timing.measureLength = #(opus-measure-length 1/4)
  b8-2 e'8-5 | \break
  \set Timing.measureLength = #(opus-measure-length 3/4)
  d'4. c'4. |
  a4. fis4-1 a8-3 |
  << { d'4.-5 b4.-5 }
     \\ { d'16-3 g d g d g b fis d fis d fis } >> |
  << { b4.-5 s4. }
     \\ { b16-3 g d g d fis g-2 fis g fis g b-1 } >> | \break
  e'4.-5 c'4~ c'16 e'16 |
  d'4. b4~ b16 d'16 |
  c'4. a4. |
  b4.-2 g4. | \break
  << { e'4.-4 g'4.-5 }
     \\ { e'16 c'-2 g c' g c' g'-5_\markup { \italic "cresc." } e'-4 g e' g e' } >> |
  << { g'4.-5 fis'4-4 e'8-5 }
     \\ { g'16 c'-2 a c' a c' fis' c' a c' e' b } >> |
  << { e'4. dis'4. }
     \\ { e'16_\markup { \italic "Dim." } a fis a fis a dis' b fis b fis b } >> |
  \set Timing.measureLength = #(opus-measure-length 1/2)
  << { e'4.~ e'8 }
     \\ { e'16 b g b g b s8 } >> \bar ":|."
}

leftHand = \fixed c {
  \global
  e4. a,4. |
  e4. b,4. |
  e4. a,4. |
  d4. d4 r8 |
  << { dis4. e4. }
     \\ { dis16-4 fis b fis b fis e-4 g c' g c' g } >> |
  << { dis4. c4. }
     \\ { dis16-5 fis b fis b fis c-5 e a e a e } >> |
  << { b,4. b,4. }
     \\ { b,16-5 e g e g e b, dis a dis a dis } >> |
  \set Timing.measureLength = #(opus-measure-length 1/2)
  << { e4. e8 }
     \\ { e16-4 g b g b g s8 } >>
  \set Timing.measureLength = #(opus-measure-length 1/4)
  r8 r8 |
  \set Timing.measureLength = #(opus-measure-length 3/4)
  << { fis4. fis4. }
     \\ { fis16 a e' a e' a fis a e' a e' a } >> |
  << { g4. g4. }
     \\ { g16 b e' b e' b g b e' b e' b } >> |
  fis4. a4. |
  g4. b4. |
  << { gis4. a4. }
     \\ { gis16 b e' b e' b a c' e' c' e' c' } >> |
  << { fis4. g4. }
     \\ { fis16 a d' a d' a g b d' b d' b } >> |
  << { e4. fis4. }
     \\ { e16 g c' g c' g fis a c' a c' a } >> |
  << { g2. }
     \\ { g16 b d' b d' b d' b d' b d' b } >> |
  c'4.-1 b4. |
  a4.~ a4 b8 |
  c'4. b4.-3 |
  \set Timing.measureLength = #(opus-measure-length 1/2)
  e'4. d8
}

\score {
  \new PianoStaff <<
    \new Staff = "upper" \rightHand
    \new Staff = "lower" { \clef bass \leftHand }
  >>
  \layout { }
}
