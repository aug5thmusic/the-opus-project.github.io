\version "2.24.3"

% LilyPond 2.24 requires a Moment; 2.26 requires a rational measure length.
% Query the property's type so this downloadable file works with either.
#(define (opus-measure-length fraction)
   (if ((object-property 'measureLength 'translation-type?) fraction)
       fraction
       (ly:make-moment (numerator fraction) (denominator fraction))))

% Independent visual transcription of IMSLP #511615, PDF page 6 (printed p. 5).
% The short bar before the repeat start and the two-eighth pickup make 6/8.
% The last bar is correspondingly short before the repeat end.

\header {
  title = "Étude No. 4"
  subtitle = "Pour les batteries avec une partie soutenue"
  composer = "Louise Farrenc"
  opus = "Op. 50, No. 4"
  tagline = ##f
}

\paper {
  #(set-paper-size "a3")
}

global = {
  \key g \major
  \time 6/8
}

right = {
  \global
  \mergeDifferentlyDottedOn
  \tempo "Poco Allegro"
  % 1–4: the rapid figure is in the upper staff.
  b'16-4\p_\markup \italic "e molto legato." [g' e' g' e' g']
    c''16 [a' e' a' e' a'] |
  b'16-4 [g' e' g' e' g']
    a'16-5 [fis' dis' fis' dis' fis'] |
  g'16-1 [e' b e' b e']
    a'16-5 [e' c' e' c' e'] |
  g'16-4 [e' b e' b e']
    fis'16-3 [cis' a cis' fis' b'] |

  % 5–8: sustained upper notes over rapid bass figures.
  b'4.-3\mf \acciaccatura d''8 c''4. |
  b'4. a'4. |
  g'4.-1 fis'4.-3 |
  \set Timing.measureLength = #(opus-measure-length 1/2)
  e'4.-2 r8 \bar ".|:"
  \set Timing.measureLength = #(opus-measure-length 1/4)
  b'8-2 [e''8-5] |
  \set Timing.measureLength = #(opus-measure-length 3/4)

  % 9–10: the rapid figure remains in the bass.
  d''4. c''4. |
  b'4. g'4-1 b'8-3 |

  % 11–12: the rapid figure returns to the upper staff.
  d''16-5 [b' d' b' d' b']
    c''16-5 [fis' d' fis' d' fis'] |
  b'16-5 [g' d' g' d' fis']
    g'16-2 [fis' g' fis' g' b'] |

  % 13–16: upper melody held over bass batteries.
  e''4.-5 c''4~ c''16 [e''16] |
  d''4. b'4~ b'16 [d''16] |
  c''4. a'4. |
  b'4.-2 g'4. |

  % 17–20: upper batteries; the final held note is in a second voice.
  e''16-4 [c''-2 g' c'' g' c'']
    g''16-5_\markup \italic "cresc." [e''-4 g' e'' g' e''] |
  g''16-5 [c''-2 a' c'' a' c'']
    fis''16-4 [c'' a' c'' e''-5 b'] |
  e''16-5_\markup \italic "dim." [a' fis' a' fis' a']
    dis''16 [b' fis' b' fis' b'] |
  \set Timing.measureLength = #(opus-measure-length 1/2)
  e''16 [b' g' b' g' b'] s8 \bar ":|."
}

rightSustain = {
  \global
  b'4. c''4. |
  b'4. a'4. |
  g'4. a'4. |
  g'4. fis'4. |
  s2.*3
  \set Timing.measureLength = #(opus-measure-length 1/2)
  s2
  \set Timing.measureLength = #(opus-measure-length 1/4)
  s4
  \set Timing.measureLength = #(opus-measure-length 3/4)
  s2.*8
  e''4. g''4. |
  g''4. fis''4 e''8 |
  e''4. dis''4. |
  \set Timing.measureLength = #(opus-measure-length 1/2)
  e''4.~ e''8
}

leftBattery = {
  \global
  \clef bass
  \mergeDifferentlyDottedOn
  % 1–4: two sustained bass notes per bar; the fourth ends with a rest.
  e4. a,4. |
  e4. b,4. |
  e4. a,4. |
  b,4. b,4 r8 |

  % 5–8: the first note of each figure also carries the sustained stem.
  cis16 [fis b fis b fis] d16 [g d' g d' g] |
  cis16 [fis b fis b fis] cis16 [e a e a e] |
  b,16 [e g e g e] b,16 [dis a dis a dis] |
  \set Timing.measureLength = #(opus-measure-length 1/2)
  e16 [g b g b g] e8 \bar ".|:"
  \set Timing.measureLength = #(opus-measure-length 1/4)
  r8 r8 |
  \set Timing.measureLength = #(opus-measure-length 3/4)

  % 9–10: six even sixteenths in each half bar.
  fis16 [a d' a d' a] fis16 [a d' a d' a] |
  g16 [b d' b d' b] g16 [b d' b d' b] |

  % 11–12: sustained bass alone.
  fis4. a4. |
  g4. b4. |

  % 13–16: bass batteries again.
  gis16 [b e' b e' b] a16 [c' e' c' e' c'] |
  fis16 [a d' a d' a] g16 [b d' b d' b] |
  e16 [g c' g c' g] fis16 [a c' a c' a] |
  g16 [b d' b d' b] d'16 [b d' b d' b] |

  % 17–20: the left hand holds the support notes.
  c'4.-1 b4. |
  a4.~ a4 b8 |
  c'4. b4. |
  \set Timing.measureLength = #(opus-measure-length 1/2)
  e'4. d8 \bar ":|."
}

leftSustain = {
  \global
  \clef bass
  s2.*4
  cis4.-4 d4.-4 |
  cis4.-5 cis4.-5 |
  b,4.-5 b,4. |
  \set Timing.measureLength = #(opus-measure-length 1/2)
  e4.-4 s8
  \set Timing.measureLength = #(opus-measure-length 1/4)
  s4
  \set Timing.measureLength = #(opus-measure-length 3/4)
  fis4.-5 fis4. |
  g4.-4 g4. |
  s2.*2
  gis4.-4 a4.-4 |
  fis4. g4.-4 |
  e4.-5 fis4.-4 |
  g2. |
  s2.*3
  \set Timing.measureLength = #(opus-measure-length 1/2)
  s2
}

\score {
  \new PianoStaff <<
    \new Staff = "upper" \with { instrumentName = "Piano" } <<
      \new Voice { \voiceTwo \right }
      \new Voice { \voiceOne \rightSustain }
    >>
    \new Staff = "lower" <<
      \new Voice { \voiceOne \leftBattery }
      \new Voice { \voiceTwo \leftSustain }
    >>
  >>
  \layout { }
}
