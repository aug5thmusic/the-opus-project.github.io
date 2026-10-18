\version "2.24.3"

% LilyPond 2.24 requires a Moment; 2.26 requires a rational measure length.
% Query the property's type so this downloadable file works with either.
#(define (opus-measure-length fraction)
   (if ((object-property 'measureLength 'translation-type?) fraction)
       fraction
       (ly:make-moment (numerator fraction) (denominator fraction))))

% Agent reconciliation candidate, not human verified.
% Source: IMSLP #511615, PDF page 6, printed page 5, A. L. 5854.
% Rechecked against BnF A-38757 (same Leduc plate), Commons page 9.
\header {
  title = "Étude No. 4"
  subtitle = "Pour les batteries avec une partie soutenue"
  composer = "Louise Farrenc"
  opus = "Op. 50, No. 4"
  tagline = ##f
}

#(set-default-paper-size "a4")
#(set-global-staff-size 18)
\paper {
  top-margin = 10\mm
  bottom-margin = 10\mm
  left-margin = 10\mm
  right-margin = 10\mm
  ragged-last-bottom = ##f
}

global = { \key g \major \time 6/8 }

upperBattery = {
  \global
  \mergeDifferentlyDottedOn
  \override Fingering.direction = #UP
  \tempo "Poco Allegro."
  % First system, bars 1–4.
  b'16-4\p_\markup { \italic "e molto legato." } [g' e' g' e' g']
    c''16 [a' e' a' e' a'] |
  b'16-4 [g' e' g' e' g']
    a'16 [fis' dis' fis' dis' fis'] |
  g'16 [e' b e' b e']
    a'16 [e' c' e' c' e'] |
  g'16 [e' a e' a e']
    fis'16-3 [dis' b dis' fis' b'] | \break

  % Second system, bars 5–8 and the two-eighth pickup.
  b'4.-3\mf \acciaccatura d''8 c''4. |
  b'4. a'4. |
  g'4.-1 fis'4.-3 |
  \set Timing.measureLength = #(opus-measure-length 1/2)
  e'4.-2 r8 \bar ".|:"
  \set Timing.measureLength = #(opus-measure-length 1/4)
  b'8-2 [e''8-5] | \break
  \set Timing.measureLength = #(opus-measure-length 3/4)

  % Third system, bars 9–12.
  d''4. c''4. |
  b'4. g'4-1 b'8-3 |
  d''16-3 [g' d' g' d' g']
    c''16-2 [fis' d' fis' d' fis'] |
  b'16-3 [g' d' g' d' fis']
    g'16-2 [fis' g' fis' g' b'] | \break

  % Fourth system, bars 13–16.
  e''4.-5 c''4~ c''16 [e''16] |
  d''4. b'4~ b'16 [d''16] |
  c''4. a'4. |
  b'4.-2 g'4. | \break

  % Fifth system, bars 17–20.
  e''16 [c''-2 g' c'' g' c'']
    g''16_\markup { \italic "cresc." } [e''-4 g' e'' g' e''] |
  g''16 [c''-2 a' c'' a' c'']
    fis''16 [c'' a' c'' e'' b'] |
  e''16_\markup { \italic "Dim." } [a' fis' a' fis' a']
    dis''16 [b' fis' b' fis' b'] |
  \set Timing.measureLength = #(opus-measure-length 1/2)
  e''16 [b' g' b' g' b'] s8 \bar ":|."
}

upperSustained = {
  \global
  \override Fingering.direction = #UP
  b'4. c''4.-1 |
  b'4. a'4.-3 |
  g'4.-1 a'4.-1 |
  g'4.-4 s4. |
  s2.*3 |
  \set Timing.measureLength = #(opus-measure-length 1/2)
  s2
  \set Timing.measureLength = #(opus-measure-length 1/4)
  s4
  \set Timing.measureLength = #(opus-measure-length 3/4)
  s2.*2 |
  d''4.-5 c''4.-5 |
  b'4.-5 s4. |
  s2.*4 |
  e''4.-4 g''4.-5 |
  g''4.-5 fis''4-4 e''8-3 |
  e''4.-5 dis''4.-2 |
  \set Timing.measureLength = #(opus-measure-length 1/2)
  e''4.~ e''8
}

lowerBattery = {
  \global
  \clef bass
  \mergeDifferentlyDottedOn
  \override Fingering.direction = #DOWN
  % Bars 1–4: the dotted bass notes are in the other voice.
  s2.*4 |
  dis16-4 [fis b fis b fis] e16-4 [g c' g c' g] |
  dis16-5 [fis b fis b fis] c16-5 [e a e a e] |
  b,16-5 [e g e g e] b,16 [dis a dis a dis] |
  \set Timing.measureLength = #(opus-measure-length 1/2)
  e16-4 [g b g b g] s8
  \set Timing.measureLength = #(opus-measure-length 1/4)
  s4
  \set Timing.measureLength = #(opus-measure-length 3/4)
  fis16-5 [a d' a d' a] fis16 [a d' a d' a] |
  g16 [b d' b d' b] g16 [b d' b d' b] |
  s2.*2 |
  gis16-4 [b e' b e' b] a16-4 [c' e' c' e' c'] |
  fis16 [a d' a d' a] g16-4 [b d' b d' b] |
  e16-5 [g c' g c' g] fis16-4 [a c' a c' a] |
  g16 [b d' b d' b] d'16 [b d' b d' b] |
  s2.*3 |
  \set Timing.measureLength = #(opus-measure-length 1/2)
  s2
}

lowerSustained = {
  \global
  \clef bass
  \override Fingering.direction = #DOWN
  e4. a,4. |
  e4. b,4. |
  e4. a,4. |
  b,4. b,4 r8 |
  dis4. e4. |
  dis4. c4. |
  b,4. b,4. |
  \set Timing.measureLength = #(opus-measure-length 1/2)
  e4. e8 \bar ".|:"
  \set Timing.measureLength = #(opus-measure-length 1/4)
  r8 r8 |
  \set Timing.measureLength = #(opus-measure-length 3/4)
  fis4. fis4. |
  g4. g4. |
  fis4. a4. |
  g4. b4. |
  gis4. a4. |
  fis4. g4. |
  e4. fis4. |
  g2. |
  c'4.-1 b4. |
  a4.~ a4 b8 |
  c'4. b4.-3 |
  \set Timing.measureLength = #(opus-measure-length 1/2)
  e'4. e8 \bar ":|."
}

\score {
  \new PianoStaff <<
    \new Staff = "upper" \with { instrumentName = "Piano" } <<
      \new Voice { \voiceTwo \upperBattery }
      \new Voice { \voiceOne \upperSustained }
    >>
    \new Staff = "lower" <<
      \new Voice { \voiceOne \lowerBattery }
      \new Voice { \voiceTwo \lowerSustained }
    >>
  >>
  \layout { }
}
