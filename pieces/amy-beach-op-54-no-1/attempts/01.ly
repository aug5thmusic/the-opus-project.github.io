\version "2.24.3"
\pointAndClickOff
#(set-global-staff-size 16)
\header {
  title = "Scottish Legend"
  composer = "Amy Beach (Mrs. H. H. A. Beach)"
  opus = "Op. 54, No. 1"
  subtitle = "First transcription — awaiting independent review"
  tagline = ##f
}
\paper {
  #(set-paper-size "a4")
  indent = 0\mm
  top-margin = 12\mm
  bottom-margin = 12\mm
}
rSplit = #(define-music-function (a b) (ly:music? ly:music?)
  #{ << \context Voice = "rhMain" { \voiceOne $a }
        \new Voice { \voiceTwo $b } >> \oneVoice \slurUp #})
lSplit = #(define-music-function (a b) (ly:music? ly:music?)
  #{ << \context Voice = "lhMain" { \voiceOne $a }
        \new Voice { \voiceTwo $b } >> \oneVoice #})
global = { \key f \major \time 4/4 \partial 8 }
right = {
  \global \slurUp \phrasingSlurUp
  \set tieWaitForNote = ##t
  \tempo "Lento con molto espressione."
  a8(^\markup\italic "sempre cantabile"
  % Printed page 2, system 1: measures 1–3.
  | <f d'>8[ <a e'> <d' f'> <e' a'>] <a' d''>4)
    \rSplit { c''8.([ d''16] } { <e' a'>4 }
  | <f' a'>4) \grace { g'16^([ a'] }
    \rSplit { g'8.[ f'16~] } { <des' f'>4 }
    <a c' f' a'>4.) c'8(
  | <a f'>8[ <c' g'> <f' a'> <g' c''>] <f' f''>4)
    \rSplit { e''8.([\arpeggio d''16] } { <e' c''>4\arpeggio } \break
  % Printed page 2, system 2: measures 4–7.
  | \rSplit { cis''16[ a'8.]) \grace { g'16^([ a'] } g'8.[ f'16] }
       { <cis' e'>4 d'4 }
    <cis' g'>4) <c'! fis'! b'! d''>8->([\arpeggio g'8]
  | <bes g'>8.[ <e' a'>16]) <g' bes'>8-.[ <bes' d''>8-.]
    <bes' d'' g'' bes''>4->\arpeggio
    <a' cis'' f'' a''>8([ <g' e'' g''>8])
  | <f' d'' f''~>8\( \tuplet 3/2 { f''16[ g'' f''] }
    <g' c''! e''>8[ <bes' d''>8]
    <a' c''>8[ <f' a'>8]
    \rSplit { d''8[ g'8]\) } { <d' a'\repeatTie>4 }
  | <d' f'>8.([ d'16] \rSplit { f'8[ c''8]) } { d'4\repeatTie }
    <f' bes' f''>8([\arpeggio <e' e''>8 <d' g' bes' d''>8
    <cis' cis''>8^\markup\italic "poco"] \break
  % Printed page 2, system 3: measures 8–11.
  | <d' f' a' d''>4)^\markup\italic "rit."
    \grace { <d' e'>32~([ bes'~ d''~ e''] }
    <d' e' bes' d''>8.[ <c'! c''!>16] <d' f' a' d''>4)
    <a' cis'' f'' a''>8.([\fermata <g' e'' g''>16])
  | \rSplit { f''16([ d''8.]) \grace { d''16([ e''] } d''8.[ cis''16] }
       { <f' a'>4 g'4 }
    <f' d''>4) \rSplit { f''8.([ d''16]) } { <f' bes'>4 }
  | \rSplit { c''16([ a'8.]) \grace { a'16([ bes'] } a'8.[ g'16] a'4) }
       { <c' f'>4 <des' f'>4 cis'4 }
    <a cis' f'>8([ <g e'>8])
  | <a d'>8.([ e'16]) \rSplit { f'8([ a'8]) } { d'4 }
    <f' d''>8([ <a' f''> <g' e''> <f' d''>]) \break
  % Printed page 2, system 4: measures 12–14.
  | \rSplit { e''16([ c''8.]) \grace { c''16([ d''] } c''8.[ bes'16] }
      { e'4 <d' f'>4 }
    <e' c''>4)
    \grace { \change Staff = "lower" f,32^\([ f ees'
      \change Staff = "upper" a'~ cis''~] }
    <a' cis'' a''>8.[\fermata g''16]
  | \rSplit { f''16[ d''8.]\) \grace { d''16([ ees''] } d''8.[ cis''16] }
      { <f' bes'>4 <ees' a'>4 }
    <d' bes' d''>4)
    \rSplit { f''8.([\arpeggio d''16]) } { <f' bes'>4\arpeggio }
  | \rSplit { c''16([ a'8.]) \grace { a'16([ bes'] } a'8.[ g'16] a'4) }
      { <c' f'>4 <des' f'>4 cis'4 }
    <a cis' f'>8([ <g e'>8]) \break
  % Printed page 2, system 5: measures 15–18.
  | <f d'>8([ <cis' e'>8]) \rSplit { f'8([ <bes' d''>8]) } { d'4 }
    <f' bes' f''>8([ <e' e''> <d' g' d''> <cis' cis''>])
  | <d' f' a' d''>4(
    \grace { <d' e'>32~[ bes'~ d''~ e''] }
    <d' e' bes' d''>8.[ <c'! c''!>16] <d' f' a' d''>4.)\fermata
    a8( \bar "||"
  | \key d \major
    \tempo \markup \italic "poco più animato"
    <fis d'>8.[ <a e'>16]) <d' fis'>8-.[ <e' a'>8-.]
    <d' a' d''>4 <b a' cis''>8([ <a g' b'>8])
  | \rSplit {
      <fis' a'>16([ <d' fis'>8.]) \grace { fis'16([ a'] }
      fis'8.[ e'16] fis'8)[ b'!8( a'8 fis'8])
    } { a4 <a d'>8[ <bes d'>8] a8[ d'8] cis'4 } \pageBreak
  % Printed page 3, system 1: measures 19–22.
  | d'8.([ <cis' e'>16] \rSplit { fis'8[ a'8]) } { d'4 }
    <d' fis' a' d''>8([ <fis' d'' fis''> <e' cis'' e''> <d' a' d''>])
  | \rSplit {
      d''16([ cis''8.]) \grace { cis''16([ d''] }
      cis''8.[ b'16] cis''8[ a'8]
      <c''! e''>8[ <b' d''>16 <a' c''>16])
    } { <cis' a'>4 <fis' a'>8[ <f'! a'>8] e'4 fis'4 }
  | <b g' b'>8.([ <d' a'>16]) <g' b'>8-.[ <a' d''>8-.]
    <g' d'' g''>4 \rSplit { d''8([ b'8]) } { <d' g'>4 }
  | <b d' g' b'>8.([ a'16]) <d' g' b'>8-.[ <b' d''>8-.]
    <b' d'' g'' b''>4->\arpeggio
    <a' cis'' fis'' a''>8([ <g' e'' g''>8]) \break
  % Printed page 3, system 2: measures 23–26.
  | \rSplit { fis''16([ d''8.]) } { <fis' b'>4 }
    <e' a' cis''>8([ <g' b'>8]
    \rSplit { a'16[ d''8.]) cis''8([ b'8]) } { fis'4 <d' fis'>4 }
  | \rSplit { a'8~([ \tuplet 3/2 { a'16 cis'' b']) } } { <d' g'>4 }
    <g' a'>8-.[( <g' a' g''>8-.)] <fis' a' fis''>4
    <fis' d'' fis''>8([ <e' e''>8])
  | <d' b' d''>8.([ <fis' cis''>16]) <b' d''>8-.[ <cis'' fis''>8-.]
    <b' fis'' b''>4 \rSplit { fis''8([ d''8]) } { <fis' b'>4 }
  | \rSplit { d''8.([ cis''16]) d''8-.[ <d'' fis''>8-.] }
      { <d' fis'>4 <gis' a'>8[ a'8] }
    <fis'' d''' fis'''>4 <e'' cis''' e'''>8([ <d'' b'' d'''>8]) \break
  % Printed page 3, system 3: measures 27–29.
  | <d'' fis'' d'''>8->([ <e'' a''>8-> <d'' fis''>8-> <b' g'' b''>8->])
    <a' fis'' a''>8->([ <fis' d'' fis''>8])
    <fis' a' cis'' fis''>8->([ <e' e''>8])
  | \rSplit { <b' d''>8([ a'8]) } { d'4 }
    \tuplet 3/2 { <d' a' d''>8->([ <e' b' e''>8-> <fis' cis'' fis''>8->]) }
    <a' e'' a''>4\fermata
    \tempo \markup \italic "lento"
    \grace { \change Staff = "lower" f,!32^\([ f! ees'
      \change Staff = "upper" a' cis''] }
    \rSplit { a''8.[\fermata g''16] } { <a'\repeatTie cis''\repeatTie>4 }
  | \key f \major
    \tempo "Tempo I."
    \rSplit { f''16[\arpeggio d''8.]\) \grace { d''16([ ees''] } d''8.[ cis''16] }
      { <f' bes'>4\arpeggio <ees' a'>4 }
    <d' bes' d''>4)
    \rSplit { f''8.([\arpeggio d''16]) } { <f' bes'>4\arpeggio } \break
  % Printed page 3, system 4: measures 30–32.
  | \rSplit { c''16([ a'8.]) \grace { a'16([ bes'] } a'8.[ g'16] a'4) }
      { <c' f'>4 <des' f'>4 cis'4 }
    <a cis' f'>8([ <g e'>8])
  | <a d'>8.([ e'16]) \rSplit { f'8([ a'8]) } { d'4 }
    <f' d''>8([ <a' f''> <g' e''> <f' d''>])
  | \rSplit { e''16([ c''8.]) \grace { c''16([ d''] } c''8.[ bes'16] }
      { e'4 <d' f'>4 }
    <e' c''>4)
    \grace { \change Staff = "lower" f,,32^\([ a, a
      \change Staff = "upper" cis' <f' a'> cis''] }
    \once \override TextScript.staff-padding = #6
    a''8.[\fermata^\markup\italic "m.s." <g' a' e'' g''>16]\) \break
  % Printed page 3, system 5: measures 33–36 (final bar: seven eighths).
  | \rSplit { f''16([ d''8.]) \grace { d''16([ e''] } d''8.[ cis''16] }
      { <f' a'>4 g'4 }
    <f' d''>4) <f' c'' f''>8.([\arpeggio des''16])
  | \rSplit { c''16([ a'8.]) } { <c' f'>4 }
    \grace { a'16([ bes'] } <des' f' a'>8.[ g'16]
    <cis' a'>4) \rSplit { f'8([ e'8]) } { <g cis'>4 }
  | <f d'>8([ <cis' e'>8]) \rSplit { f'8([ <bes' d''>8]) } { d'4 }
    <f' bes' f''>8([ <e' e''>8-. <d' g' d''>8 <cis' cis''>8]
  | \partial 8*7
    <d' f' a' d''>4)
    \grace { <d' e'>32~([ bes'~ d''~ e''] }
    <d' e' bes' d''>8.[ <c'! c''!>16] <d' f' a' d''>4.)\fermata \bar "|."
}
left = {
  \global \clef bass \mergeDifferentlyDottedOn \set tieWaitForNote = ##t
  a,8~(
  | <d, a,>8[ <a, e> <d f> <e a>] <f a d'>4) <a c'>4
  | <f c'>4 \lSplit { f4(~ f8 c4) c8~( } { bes,4( f,4.) c8 }
  | <f, c>8[ <c g> <f a> <g c'>] <a c'>4) <g, bes>4\arpeggio
  | <a, e a>4 \lSplit { bes4 s4 } { f8([ e8~] <a, e a>4) } <d, d>4->
  | <g, d>8.([ <d a>16]) <g bes>8-.[ <bes d'>8-.]
    <e g'>4->\arpeggio \lSplit { f'8([ e'8]) } { <a cis'>4 }
  | <d a d'>4( <e c'! e'>8[ d'8] <f c'>4)
    \lSplit { <f a>8([ <e g>8]) } { a,4 }
  | <a, f a>4 <bes, f>4 <g, bes>4\arpeggio <a, e a>4
  | <d a>4( \grace { g,16~[ e~] } <g, e bes>4)
    <d a>8.[ a,16]
    \lSplit { f'8.([ e'16]) } { <a cis'>4_\fermata }
  | <d~ a d'>4( <d bes e'>4) <d a d'>4
    <bes, f d'>8.([\arpeggio <a, bes>16])
  | \lSplit { a16([\arpeggio f8.]) } { f,4\arpeggio }
    \lSplit { f4(~ f8[ e8]) } { bes,4( a,4) }
    <a,, a,~>4(
  | <d, a,>4) <d a~>4( <g, a>8[ c'8 <g b!>8 a8])
  | <c g>4 \lSplit { a8.([\arpeggio f16] } { f,4\arpeggio }
    <c g>4)
    \grace { s32*5 } <f\repeatTie ees'\repeatTie>4\fermata
  | <bes, f d'>4\arpeggio <c~ ges>4 <c f>4 <gis, d bes>4\arpeggio
  | <a, f a>4
    \lSplit { f4(~ f8[ e8]) } { bes,4( a,4) } <a,, a,>4
  | <a,, a,>8([ g8]) <a, f>4 <g, bes>4\arpeggio <a, e a>4
  | <d a>4( \grace { g,16~[ e~] } <g, e bes>4)
    d,8([ a,8 f8\fermata]) a,8~( \bar "||"
  | \key d \major
    <d, a,>8.[ <a, e>16]) <d fis>8-.[ <e a>8-.]
    <fis a>4 <g, d>4
  | <d, d>4 <fis, d~>4\( <d, d>8[ fis8~]
    \lSplit { fis8[ g8]\) } { a,4 }
  | <b,~ fis>4( <b, b>8[ fis8]) <e, b, a>4\arpeggio
    \lSplit { cis'8([ b8]) } { <e gis>4 }
  | <a, e a>4 <d a>4 \lSplit { a8([ cis'8 e'8 d'8]) } { a,4 d4 }
  | <g, d>8.([ <d a>16]) <g b>8-.[ <a d'>8-.]
    <b d'>4 <g, d b>4\arpeggio
  | <e, e>4 <e b>8-.[ <b d'>8-.] <e g'>4->\arpeggio
    \lSplit { fis'8([ e'8]) } { <a cis'>4 }
  | <b, fis e'>4 \lSplit { <a cis'>8([ b8]) } { cis4 }
    <d a>4 \lSplit { fis8([ b8]) } { gis,4 }
  | <a, e a>4 <a, e b>8([_\markup\italic "marcato." <a cis'>8-.)]
    \lSplit { e'8->([ d'8]) a8([ fis8]) } { <d a>4 a,4 }
  | <b, fis>8.([ <fis cis'>16]) <b d'>8-.[ <cis' fis'>8-.]
    <d' fis'>4 <b, fis d'>4\arpeggio
  | <e, b, gis>4\arpeggio <gis e'>8-.[ <gis e' gis'>8-.]
    \clef treble <eis' fis' d''>4
    \lSplit { cis''8([ b'8]) } { <d' fis'>4 } \clef bass
  | <a, e e'>8->([\arpeggio <fis' a'>8-> <cis' e' g'>8-> <b g'>8->])
    \lSplit { fis'8->[ cis'8] a8([ fis8]) } { a4 a,4 }
  | <b, fis>4 <e, b, gis>8-.[\arpeggio <e gis e'>8-.]
    <a,~ e~ e'>8([\arpeggio <a, e d'>8\fermata])
    \grace { s32*5 } <f\repeatTie ees'\repeatTie>4_\fermata
  | \key f \major
    <bes, f d'>4\arpeggio <c~ ges>4 <c f>4 <gis, d bes>4\arpeggio
  | <a, f a>4 \lSplit { f4(~ f8[ e8]) } { bes,4( a,4) }
    <a,, a,~>4(
  | <d, a,>4) <d a~>4\(
    \lSplit { a8[ c'8 <g b!>8 a8]\) } { g,4 }
  | <c g>4 \lSplit { a8.([\arpeggio f16] } { f,4\arpeggio }
    <c g>4) \grace { s32*6 } r8\fermata r16 <g cis'>16
  | <d~ a d'>4( <d bes e'>4) <d a d'>4
    <bes, f des'>8.([\arpeggio bes16])
  | \lSplit { a16([\arpeggio f8.]) } { f,4\arpeggio }
    \lSplit { f4(~ f8[ e8]) } { bes,4( a,4) } <a,, a,>4
  | <a,, a,>8([ g8]) <a, f>4 <g, bes>4\arpeggio <a, e a>4
  | <d a>4( \grace { g,16~[ e~] } <g, e bes>4)
    \lSplit { d,8([ a,8 f8\fermata]) } { d,4._\fermata }
}
dynamics = {
  \partial 8 s8\p
  | s1
  | s1
  | s2\< s2\!
  | s16 s8.\> s2 s4\!\mf
  | s2\< s2\!
  | s2. s4_\markup\italic "dim."
  | s1
  | s4 \grace { s32\pp s32*3 } s2 s4\mf
  | s1^\markup\italic "a tempo"
  | s16 s8.\> s4 s2\!
  | s2\< s2\!
  | s4 s4\> s4\! \grace { s32\pp s32*4 } s4
  | s1
  | s1
  | s4\< s4\! s2\>_\markup\italic "ritenuto"
  | s4 \grace { s32\!\pp s32*3 } s2 s8_\markup\italic "lunga" s8\mf
  | s1
  | s1
  | s4 s2._\markup\italic "cresc."
  | s2. s4\<
  | s1\!\f
  | s1
  | s4 s2._\markup\italic "dim."
  | s4\> s4\!\pp^\markup\italic "rit." s4 s4\<^\markup\italic "a tempo"
  | s1\!_\markup\italic "cresc."
  | s2\< s2\!\ff_\markup\italic "sostenuto"
  | s1
  | s4 s4^\markup\italic "rit." s4_\markup\italic "lunga"
    \grace { s32\pp s32*4 } s4_\markup\italic "lunga"
  | s1_\markup\italic "dolcissimo"
  | s1
  | s1
  | s4 s2^\markup\italic "rall." s4_\markup\italic "lunga"
  | s1_\markup\italic "più tranquillo"
  | s1_\markup\italic "sempre dim."
  | s2 s2_\markup\italic "molto ritenuto"
  | s4 \grace { s32\ppp s32*3 } s4 s4\> s8\!
}
pedal = {
  \partial 8 s8
  | s8\sustainOn s8\sustainOff s2. % 1
  | s1 % 2
  | s4\sustainOn s2\sustainOff s8.\sustainOn s16\sustainOff % 3
  | s1 % 4
  | s4\sustainOn s8\sustainOff s4.\sustainOn s4\sustainOff % 5
  | s1 % 6
  | s2 s4\sustainOn s4\sustainOff % 7
  | s4 \grace { s32\sustainOn s32*3 } s8 s4\sustainOff s8\sustainOn s8. s16\sustainOff % 8
  | s2. s8.\sustainOn s16\sustainOff % 9
  | s8\sustainOn s8\sustainOff s2. % 10
  | s4 s2\sustainOn s4\sustainOff % 11
  | s4 \grace { s32\sustainOn s32*4 } s8. s16\sustainOff s4 \grace { s32\sustainOn s32*4 } s8. s16\sustainOff % 12
  | s4\sustainOn s2\sustainOff s8.\sustainOn s16\sustainOff % 13
  | s1 % 14
  | s8\sustainOn s4.\sustainOff s4\sustainOn s4\sustainOff % 15
  | s4 \grace { s32\sustainOn s32*3 } s8 s8\sustainOff s4\sustainOn s4\sustainOff % 16
  | s4.\sustainOn s8\sustainOff s2 % 17
  | s1 % 18
  | s2 s4\sustainOn s4\sustainOff % 19
  | s1 % 20
  | s4\sustainOn s4\sustainOff s4\sustainOn s8.\sustainOff s16 % 21
  | s8\sustainOn s2. s8\sustainOff % 22
  | s2. s8\sustainOn s8\sustainOff % 23
  | s1 % 24
  | s4\sustainOn s4\sustainOff s4\sustainOn s8.\sustainOff s16 % 25
  | s2.\sustainOn s4\sustainOff % 26
  | s8\sustainOn s8\sustainOff s2. % 27
  | s4 s8\sustainOn s8\sustainOff s8\sustainOn s8\sustainOff \grace { s32\sustainOn s32*4 } s8. s16\sustainOff % 28
  | s4\sustainOn s2\sustainOff s8.\sustainOn s16\sustainOff % 29
  | s1 % 30
  | s2 s4\sustainOn s4\sustainOff % 31
  | s4 \grace { s32\sustainOn s32*5 } s8. s16\sustainOff s4 \grace { s32\sustainOn s32*5 } s8. s16\sustainOff % 32
  | s2. s8.\sustainOn s16\sustainOff % 33
  | s4\sustainOn s2.\sustainOff % 34
  | s8\sustainOn s4.\sustainOff s4\sustainOn s4\sustainOff % 35
  | s4 \grace { s32\sustainOn s32*3 } s8 s8\sustainOff s4\sustainOn s8\sustainOff % 36
}
\score {
  \new PianoStaff <<
    \new Staff = "upper" \new Voice = "rhMain" \right
    \new Dynamics \dynamics
    \new Staff = "lower" << \new Voice = "lhMain" \left \pedal >>
  >>
  \layout {
    \context { \Score autoBeaming = ##f }
    \context {
      \Staff
      \consists "Span_arpeggio_engraver"
      connectArpeggios = ##t
    }
  }
}
