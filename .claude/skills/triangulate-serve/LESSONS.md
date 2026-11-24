# Lessons: cleaning a 2D serve track

Failure modes met while triangulating a serve, each with the fix that held. Read before step 6 of `SKILL.md`, and again
whenever a step's number gets worse.

## Hand and limb identity
- **Trust the tracker's own left/right labels**, verified by eye on the stills. Re-deciding identity against the 3D
  capture or by continuity swapped the arms during the racket drop, where the hands really do cross.
- After landing the hidden racket hand may vanish behind the body: give it a rule (where it ends up) rather than a guess.
- Push two hands (or two knees) apart when they would sit inside each other.

## Jumps and outliers
- Drop a point that jumps far from the median of its **near** neighbours only. A wide window or a tight threshold
  kills the real, very fast swing at contact; tune on the contact frames.
- A shoulder the tracker loses in the contact blur: place a **virtual shoulder** from the hips and the torso fit, but
  only when its confidence is low or it is clearly off; too eager a rule adds error at contact.
- Elbow with low confidence but a good hand: put it on the shoulder–hand line (straight arm).

## Blur and lost frames
- Fill blurred frames from clear neighbours **relative to the hips**, only across short gaps, and only in phases where
  it cannot hide a later rule (e.g. not into the finish).
- Frames with no pose at all: bridge from the nearest frame that has one; give lost-arm frames empty targets so
  later rules still run on them.

## Things that looked useful and were not
- Reading overlay colours to identify limbs: court and crowd share the colours. Use text labels and the pose instead.
- Matching knees to the hip–ankle chord: worse than matching the picture's knee offset from the hip directly.
- A planted-foot threshold that assumes flat feet: servers rise onto their toes; set it from the clip.

## Checks that caught real bugs
- Bone length range over the whole serve (should be one value).
- Worst frame-to-frame jump per joint, with its time — spikes cluster at tracker failures and solver flips.
- Which side the toss arm and racket are on as the **user** sees them (near end, from behind), not as stored.
- Contact: wrist height and arm straightness on the frame the game strikes the ball.
