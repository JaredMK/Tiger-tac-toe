// Tic Tac Chaos: the physics of Mini Golf, Pool and Bowling, on Matter.js (MIT, https://brm.io/matter-js).
// One module for the page (Matter from cdnjs: makePhysics(window.Matter)) and for Node (the Cloud
// Functions and the tests: makePhysics(require('matter-js'))). A shot is an aim (radians, 0 straight up the table) and a power (0..1);
// a run is the whole thing played out in fixed steps until everything has stopped, with a recording
// of every body's place 30 times a second and the events along the way (bounces, the cup, the pockets,
// the pins), so the phones replay exactly what the server (or the shooter's phone) worked out.
// Tables are in units: 100 across; Mini Golf 160 tall, Pool 180, Bowling 240; y grows downward (the
// tee, the cue and the bowling ball are at the bottom, the cup, the rack and the pins at the top).
export function makePhysics(Matter) {
  const { Engine, Bodies, Body, Composite, Events, Vector } = Matter;
  // Matter takes a slow contact for a resting one (no bounce) below a threshold meant for pixel-sized
  // worlds; on these small tables every ball would stick to what it hit. Set for these tables, the same
  // everywhere, so the server and the phones work out the same shot.
  if (Matter.Resolver) Matter.Resolver._restingThresh = 0.04;
  const STEP = 1000 / 120, FPS = 30, SUB = 4;                  // 120 Hz physics, a recorded frame every 4 steps
  // The time scale of Mini Golf, Pool and Bowling: a shot plays 1.5 times as fast as the world it is worked
  // out in (the recording at 45 frames a second, the events' times to match), so the balls travel and slow
  // down half as fast again along exactly the same paths: every shot goes just as far, ends just the same.
  const TS = 1.5;
  const r1 = x => Math.round(x * 10) / 10 + 0;
  const r2 = x => Math.round(x * 100) / 100 + 0;

  // ---------- the tables ----------
  const GOLF = { w: 100, h: 160, ballR: 2.4, cupR: 3.6, holeSpeed: 32, lipKick: 0.5, vMax: 95, reach: 174, maxT: 9, air: 0.004, roll: 12, kick: 18, kickKeep: 0.85, kickMax: 95 };   // full power: a full putt rolls about reach on open ground (more than the course is long); reach is for the computer's aim, not a cap. A bumper kicks a ball straight off it: kickKeep of its speed and kick more (kickMax at most)
  // Pool: a full-power shot runs the table's length 3 times and more (off the far rails twice or more); the
  // power is the meter's level and the speed goes with its square (curve), so a light tap is still light.
  // At that speed each step is cut in four (sub), so no ball passes through a rail or another ball.
  // The balls meet as true circles (November 2026, CLIENT_VERSION 1.13.0): Matter makes a small circle a ten-sided
  // polygon, and two of them came off each other along a face of the polygon, up to 18 degrees off the line through
  // their centres, so a ball aimed dead at a pocket could miss it by a pocket's width. Now each ball is a polygon of
  // `sides` sides (round to a hundredth of a unit) and, where two meet, their speeds are set from the line through
  // their centres at the moment they touched (bounce: how much of the closing speed comes back), as the aim line on
  // the table draws it (pool/rules.js poolSight). evMin: the gentlest touch that still makes an event (its sound), in
  // the collision's own speed units (an eighth of the units a second at this table's sub-steps).
  const POOL = { w: 100, h: 180, ballR: 3.9, vMax: 300, curve: 2, sub: 4, maxT: 12, air: 0.004, roll: 9, sides: 40, bounce: 0.88, evMin: 0.5,
    pockets: [[0, 0, 8.4], [100, 0, 8.4], [0, 90, 8.4], [100, 90, 8.4], [0, 180, 8.4], [100, 180, 8.4]],   // x, y, the reach of the pocket (and its size as drawn): about 2.2 times the ball across (balls half as big again as they were, pockets twice the size)
    start: { cue: [50, 140], black: [50, 50], x1: [34, 68], x2: [66, 68], x3: [50, 84], o1: [50, 68], o2: [34, 84], o3: [66, 84] } };   // (three each: two rows of three, alternating, 16 apart across and 16 down)
  // Bowling (reworked November 2026): the rack is a true triangle, every pin 10 from its neighbours (rows 8.66 apart: a
  // ball 8 across cannot slip between two pins, as it could while the rows stood 12 apart), the ball a little bigger and
  // heavier (ballDensity), so it carries through the rack. A pin knocked off its spot is a pin lying down: from then on
  // it sweeps a wider path (fall times its width) and takes its neighbours with it, as a fallen pin does; one that has
  // slowed to a slide (under pinSlow) grinds to a halt (pinGrip more), so the rack settles soon after the ball has gone.
  // A roll into the pocket beside the head pin strikes; dead centre leaves a pin or two.
  const BOWL = { w: 100, h: 240, ballR: 4, pinR: 2.2, vMax: 150, maxT: 7, air: 0.002, roll: 4, pinAir: 0.004, pinRoll: 6, pinBounce: 0.9, still: 6, gutter: 7, knocked: 2.2, pit: 3,   // pit: past the end of the lane (y 0) the ball and the pins drop into the pit (drawn 6 deep) and are gone: nothing bounces back
    ballDensity: 0.04, fall: 1.3, pinGrip: 40, pinSlow: 25,
    start: [50, 214], pins: [[50, 50], [45, 41.34], [55, 41.34], [40, 32.68], [50, 32.68], [60, 32.68], [35, 24.02], [45, 24.02], [55, 24.02], [65, 24.02]] };
  // Mini Golf's holes: walls as [cx, cy, w, h, angle], bumpers as [cx, cy, r], the tee and the cup, and a
  // path (the way round, for the computer's aim). Both balls start side by side on the tee. A full putt
  // crosses the whole course; the difficulty is the course: every hole has turns, walls and bumpers in the
  // way (walls that turn the way back on itself, bumpers round it that kick the ball off them; the path is dense, a
  // point every 5 to 15 units down the middle of the way, for the computer's aim), and takes the computer (with its
  // usual error) 4 to 6 putts on average. 22 layouts made by hand,
  // then the mirror image of each that is not its own (20 more); a hole's `of` is its layout. (The first six
  // keep their places: a square dealt one before plays on with it.)
  const wallTo = (x1, y1, x2, y2, t = 5) => [(x1 + x2) / 2, (y1 + y2) / 2, Math.hypot(x2 - x1, y2 - y1), t, +Math.atan2(y2 - y1, x2 - x1).toFixed(3)];   // a wall from one point to another
  const LAYOUTS = [
    { name: 'Zigzag', tee: [50, 148], cup: [30, 18],
      walls: [[35, 116, 70, 6, 0], [65, 70, 70, 6, 0], [50, 36, 5, 30, 0], [83.3, 111.1, 15.6, 5, 1.985], [23.9, 41.4, 26, 5, 2.671]],
      bumpers: [[50, 92, 4.5], [76, 24, 4], [34, 52, 3.5], [90, 88, 4], [10, 100, 3]],
      path: [[62, 146], [72, 138], [80, 135], [93, 109], [91, 100], [72, 95], [68, 96], [69, 87], [73, 87], [37, 82], [15, 76], [15, 66], [41, 60], [44, 59], [38, 13], [30, 18]] },
    { name: 'Dogleg', tee: [18, 146], cup: [22, 20],
      walls: [[34, 98, 68, 6, 0], [44, 50, 48, 5, 0.42], [12, 70, 24, 5, 0], [73.5, 110.7, 19.1, 5, 0.66]],
      bumpers: [[88, 84, 5], [62, 76, 4], [70, 24, 4.5], [60, 124, 4], [14, 124, 4], [90, 50, 3], [88, 136, 4.5], [48.3, 35.5, 4.8]],
      path: [[30, 146], [42, 146], [54, 146], [65, 143], [69, 141], [91, 119], [87, 102], [79, 97], [80, 65], [74, 43], [71, 44], [52, 17], [46, 16], [34, 22], [22, 20]] },
    { name: 'The horseshoe', tee: [50, 148], cup: [50, 30],
      walls: [[50, 12, 60, 6, 0], [23, 35, 6, 52, 0], [77, 35, 6, 52, 0], [10, 58, 20, 6, 0], [90, 58, 20, 6, 0], [50, 102, 50, 6, 0], [50, 76, 24, 5, 0], [33.8, 82.4, 28, 5, 0.142], [66.2, 82.4, 28, 5, -0.142]],
      bumpers: [[12, 104, 5], [88, 104, 5], [36, 126, 4], [64, 126, 4], [20, 140, 3], [80, 140, 3]],
      path: [[60, 144], [82, 122], [79, 119], [79, 91], [91, 86], [89, 72], [55, 58], [59, 59], [58, 52], [57, 40], [50, 30]] },
    { name: 'The funnel', tee: [50, 148], cup: [50, 20],
      walls: [[19, 96, 56, 6, -0.544], [81, 96, 56, 6, 0.544], [50, 56, 34, 5, 0], [86, 34, 28, 5, -0.5], [50.1, 99, 25, 5, 0.739]],
      bumpers: [[50, 126, 4], [30, 72, 3.5], [24, 14, 4.5], [74, 20, 3.5], [12, 138, 4], [65.1, 29.5, 4.5], [89, 84.5, 4.7], [28.7, 37.3, 4.7]],
      path: [[57, 143], [67, 133], [68, 119], [75, 114], [50, 87], [51, 70], [82, 67], [82, 60], [82, 56], [47, 33], [46, 29], [50, 20]] },
    { name: 'Round the bar', tee: [50, 148], cup: [50, 22],
      walls: [[56, 76, 88, 6, 0], [86, 114, 28, 5, 0.6], [50, 40, 30, 5, 0], [16, 34, 22, 5, 0.6], [26.8, 94.7, 57.6, 5, 0.028]],
      bumpers: [[50, 112, 5], [74, 50, 4], [26, 58, 3.5], [12, 134, 3.5], [32, 18, 4], [68, 14, 3]],
      path: [[52, 136], [56, 130], [68, 122], [67, 96], [69, 92], [83, 93], [39, 85], [27, 85], [15, 86], [7, 86], [9, 62], [13, 50], [15, 64], [33, 66], [53, 58], [57, 58], [87, 61], [85, 35], [79, 30], [53, 23], [50, 22]] },
    { name: 'Pinball', tee: [50, 148], cup: [50, 18],
      walls: [[18, 66, 30, 5, 0.5], [82, 66, 30, 5, -0.5], [36, 30, 5, 22, 0], [64, 30, 5, 22, 0], [50, 8, 34, 5, 0], [50, 109.9, 16, 5, 0], [15.5, 115.6, 26.4, 5, 1.614], [84.5, 115.6, 26.4, 5, -1.614]],
      bumpers: [[30, 108, 6], [70, 108, 6], [50, 86, 6], [50, 50, 5], [16, 40, 4], [84, 40, 4], [50, 126, 3.5], [22, 140, 4], [78, 140, 4], [70.3, 90.9, 4.7], [29.7, 90.9, 4.7], [14.5, 93.9, 3.2], [85.5, 93.9, 3.2], [89.2, 19.3, 4.9], [10.8, 19.3, 4.9]],
      path: [[40, 146], [10, 148], [6, 110], [8, 84], [13, 79], [37, 81], [49, 67], [33, 56], [50, 35], [50, 31], [50, 22], [50, 18]] },
    { name: 'Switchback', tee: [40, 148], cup: [30, 18],
      walls: [[28, 122, 56, 5, 0], [72, 86, 56, 5, 0], [28, 50, 56, 5, 0], [66.8, 63.6, 20.3, 5, 1.044], [75.5, 43.8, 24.1, 5, 1.511]],
      bumpers: [[62, 26, 3], [90, 104, 3], [30, 76, 4.5]],
      path: [[50, 140], [59, 139], [71, 117], [55, 105], [46, 104], [29, 96], [50, 69], [64, 79], [92, 75], [88, 68], [86, 16], [76, 15], [48, 16], [42, 18], [30, 18]] },
    { name: 'Island', tee: [50, 148], cup: [50, 60],
      walls: [[32, 60, 5, 30, 0], [68, 60, 5, 30, 0], [50, 75, 41, 5, 0], [86, 96, 28, 5, -0.4], [66, 128.8, 72.1, 5, -3.098], [46.3, 30, 28.5, 5, 2.585]],
      bumpers: [[22, 112, 5], [64, 116, 4], [80, 30, 4], [30, 14, 4.5], [30, 140, 3.5], [58.7, 91.8, 3.2]],
      path: [[48, 146], [18, 149], [15, 130], [12, 98], [14, 94], [14, 84], [14, 72], [14, 62], [14, 50], [14, 38], [18, 28], [14, 35], [46, 13], [71, 15], [50, 48], [50, 60]] },
    { name: 'Gates', tee: [30, 148], cup: [24, 20],
      walls: [[24, 122, 48, 5, 0], [92, 122, 16, 5, 0], [8, 90, 16, 5, 0], [74, 90, 52, 5, 0], [32, 58, 64, 5, 0], [33.1, 113.6, 70.6, 5, 0.096]],
      bumpers: [[86, 36, 3.5], [88, 140, 3.5], [10, 140, 4], [54, 12, 3], [76, 16, 4.5]],
      path: [[42, 146], [54, 145], [64, 137], [69, 134], [83, 106], [61, 103], [33, 96], [33, 84], [33, 78], [59, 74], [78, 69], [79, 58], [67, 40], [57, 40], [48, 40], [39, 35], [30, 26], [24, 20]] },
    { name: 'Spiral', tee: [50, 148], cup: [60, 82],
      walls: [[39, 112, 78, 5, 0], [78, 79, 5, 66, 0], [67, 46, 22, 5, 0], [42.3, 50.6, 16.4, 5, 0.517], [53.4, 33.9, 28.6, 5, 3.006]],
      bumpers: [[56, 18, 3.5], [14, 26, 4], [18, 72, 3]],
      path: [[61, 145], [70, 137], [79, 130], [86, 129], [90, 107], [90, 95], [90, 83], [90, 71], [90, 59], [86, 29], [82, 26], [80, 15], [50, 8], [37, 17], [32, 20], [20, 44], [37, 67], [50, 74], [60, 82]] },
    { name: 'Hairpin', tee: [24, 148], cup: [76, 136],
      walls: [[50, 98, 5, 124, 0], [39.1, 34.8, 24.5, 5, 1.258], [64, 87.6, 17.3, 5, 2.652]],
      bumpers: [[22, 96, 5], [78, 74, 5], [50, 18, 4.5], [14, 54, 3], [88, 116, 4.5], [90, 12, 3.5], [30.9, 14.3, 4.4]],
      path: [[24, 136], [24, 124], [24, 116], [28, 114], [32, 78], [32, 66], [30, 60], [22, 38], [21, 34], [16, 26], [14, 22], [22, 7], [44, 5], [69, 15], [67, 26], [67, 30], [68, 44], [71, 53], [86, 55], [88, 89], [86, 95], [78, 100], [69, 114], [75, 130], [76, 136]] },
    { name: 'Chicane', tee: [50, 148], cup: [78, 18],
      walls: [[25, 106.5, 51.662, 5, 0.254], [75, 78.5, 51.662, 5, 0.254], [25, 42.5, 51.662, 5, 0.254], [63.2, 125.1, 23.9, 5, 0.782]],
      bumpers: [[92, 142, 3.5], [64, 36, 4.5], [36, 78, 3.5]],
      path: [[59, 146], [76, 147], [84, 121], [75, 112], [68, 105], [51, 96], [46, 93], [21, 88], [19, 82], [24, 65], [29, 62], [64, 58], [73, 53], [82, 41], [78, 23], [78, 18]] },
    { name: 'Corner pocket', tee: [50, 148], cup: [88, 16],
      walls: [[65, 66, 70, 5, 0], [89, 33.5, 23.087, 5, -0.308], [12, 104, 24, 5, 0], [32.1, 86.6, 68.2, 5, 0.042], [59.9, 27.5, 22.9, 5, 0.337]],
      bumpers: [[40, 116, 5], [60, 44, 3.5], [10, 16, 4], [74, 140, 3]],
      path: [[50, 136], [54, 130], [59, 113], [62, 106], [69, 105], [81, 87], [85, 85], [49, 78], [37, 78], [27, 79], [10, 75], [14, 55], [14, 51], [21, 41], [30, 32], [35, 21], [37, 14], [73, 14], [88, 16]] },
    { name: 'Bumper alley', tee: [50, 148], cup: [14, 22],
      walls: [[31, 91, 5, 82, 0], [69, 91, 5, 82, 0]],
      bumpers: [[42, 112, 5], [58, 92, 5], [42, 72, 5], [58, 58, 4], [50, 34, 5], [10, 40, 4], [84, 122, 3], [30, 12, 4.5], [54.4, 123, 3.3], [87.9, 32.6, 4.8], [90.6, 102.1, 3.5], [23.5, 35.2, 3.2]],
      path: [[62, 146], [86, 143], [85, 139], [86, 146], [92, 116], [80, 108], [85, 84], [85, 72], [85, 60], [69, 36], [68, 27], [69, 30], [49, 15], [35, 27], [14, 22]] },
    { name: 'The cross', tee: [50, 148], cup: [50, 34],
      walls: [[50, 88, 48, 5, 0], [50, 88, 5, 48, 0], [36, 38, 20, 5, 0.927], [64, 38, 20, 5, 2.214], [34.4, 120.2, 73, 5, 0.081], [66.6, 66.6, 15.9, 5, 0.331]],
      bumpers: [[82, 122, 5], [74, 12, 3], [12, 140, 4.5], [72, 56, 3.5], [32, 70, 4], [73.5, 139.1, 3.7], [84.3, 104.5, 3.9]],
      path: [[56, 146], [88, 145], [89, 137], [92, 113], [92, 95], [86, 73], [83, 42], [85, 38], [85, 24], [57, 19], [50, 28], [50, 34]] },
    { name: 'Ladder', tee: [50, 148], cup: [50, 20],
      walls: [[16, 122, 32, 5, 0], [84, 122, 32, 5, 0], [50, 98, 30, 5, 0], [16, 74, 32, 5, 0], [84, 74, 32, 5, 0], [50, 50, 30, 5, 0], [33, 63.1, 21.2, 5, 0.266]],
      bumpers: [[74, 50, 3.5], [88, 98, 4.5], [14, 38, 3.5], [30, 140, 4], [72.2, 29.7, 3.3], [23, 20.2, 4.9], [55, 33.3, 4], [70.8, 141.9, 3.3], [51.8, 73.4, 3.6]],
      path: [[52, 136], [53, 124], [53, 116], [77, 109], [77, 88], [58, 85], [64, 63], [88, 59], [86, 39], [86, 19], [82, 15], [60, 16], [50, 16], [50, 20]] },
    { name: 'Moat', tee: [50, 148], cup: [50, 42],
      walls: [[50, 102, 52, 5, 0], [82.4, 95.5, 39.2, 5, -3.106], [23.9, 122.8, 52.8, 5, -0.195]],
      bumpers: [[39.4, 31.4, 3.6], [35, 42, 3.6], [50, 57, 3.6], [60.6, 52.6, 3.6], [60.6, 31.4, 3.6], [84, 124, 4], [22, 138, 3.5], [24, 86, 4], [10, 14, 3]],
      path: [[52, 136], [59, 133], [88, 109], [31, 112], [13, 108], [11, 97], [45, 89], [42, 85], [45, 78], [55, 75], [64, 70], [77, 46], [76, 42], [50, 42]] },
    { name: 'Keyhole', tee: [50, 148], cup: [50, 22],
      walls: [[38, 28, 5, 28, 0], [62, 28, 5, 28, 0], [30, 75, 26.907, 5, 0.733], [70, 75, 26.907, 5, 2.409], [25.8, 51, 55.8, 5, -0.057], [34.6, 94.9, 73.5, 5, 0.079]],
      bumpers: [[50, 110, 5], [16, 40, 4], [84, 40, 4], [52, 64, 4], [10, 120, 3], [70, 140, 4.5], [30, 140, 3.5], [79.4, 51.7, 3.5], [74.5, 114.4, 5]],
      path: [[52, 134], [53, 130], [85, 130], [85, 98], [86, 88], [90, 60], [87, 82], [94, 37], [85, 22], [80, 17], [81, 14], [59, 8], [51, 14], [50, 22]] },
    { name: 'The lobby', tee: [50, 148], cup: [14, 18],
      walls: [[20, 80, 40, 5, 0], [80, 80, 40, 5, 0], [30, 36, 5, 40, 0], [64.5, 68.4, 75.6, 5, -3.018], [29.1, 114, 62.6, 5, 0.114]],
      bumpers: [[50, 104, 5], [80, 120, 4], [58, 50, 3], [14, 124, 4.5], [10, 66, 3.5]],
      path: [[53, 137], [61, 136], [75, 101], [70, 101], [68, 97], [69, 101], [47, 75], [35, 73], [19, 71], [14, 49], [14, 37], [14, 25], [14, 18]] },
    { name: 'Diamond', tee: [50, 148], cup: [50, 28],
      walls: [[40, 76, 28.284, 5, -0.785], [60, 76, 28.284, 5, 0.785], [40, 96, 28.284, 5, 0.785], [60, 96, 28.284, 5, -0.785], [8, 52, 16, 5, 0], [91, 86, 18, 5, 0], [37.6, 134.1, 15.2, 5, 2.498]],
      bumpers: [[50, 44, 4], [86, 46, 4], [20, 124, 3.5], [36, 26, 3], [66, 24, 3], [12, 68, 4.5], [56, 128, 3.5], [10, 96, 4], [25.6, 109.2, 4.7], [67.7, 120.5, 4.9], [83.1, 17.9, 3.2]],
      path: [[44, 148], [15, 142], [11, 112], [24, 96], [15, 83], [30, 64], [65, 55], [67, 51], [50, 28]] },
    { name: 'Double dogleg', tee: [84, 148], cup: [16, 20],
      walls: [[73, 105, 55.785, 5, -2.888], [27, 63, 55.785, 5, -0.254], [74, 32, 5, 28, 0], [63.9, 66, 27.3, 5, 1.521], [33.3, 95.2, 27.2, 5, 2.229]],
      bumpers: [[30, 120, 5], [32, 40, 3], [58, 12, 3.5], [90, 128, 4], [90, 88, 3]],
      path: [[72, 146], [60, 146], [48, 146], [38, 142], [29, 139], [14, 132], [15, 91], [18, 87], [21, 82], [49, 73], [62, 89], [82, 73], [82, 65], [81, 60], [89, 32], [89, 20], [88, 13], [71, 10], [56, 30], [42, 20], [34, 20], [22, 20], [16, 20]] },
    { name: 'Pinwheel', tee: [50, 148], cup: [50, 80],
      walls: [[40, 64, 28, 5, 0], [66, 72, 5, 24, 0], [60, 96, 28, 5, 0], [34, 88, 5, 24, 0], [24, 105.3, 52.4, 5, 0.138], [64.4, 126.4, 16.3, 5, 1.291]],
      bumpers: [[50, 128, 3.5], [40, 24, 4], [88, 38, 3], [86, 110, 4.5]],
      path: [[52, 146], [78, 146], [83, 131], [77, 123], [79, 83], [87, 87], [59, 89], [50, 80]] },
  ];
  const r2h = v => Math.round(v * 100) / 100 + 0;
  const r3h = v => Math.round(v * 1000) / 1000 + 0;   // (walls keep three decimals, so a mirrored wall meets its neighbours as exactly as the original)
  const mirror = h => ({ name: h.name + ', mirrored', tee: [r2h(100 - h.tee[0]), h.tee[1]], cup: [r2h(100 - h.cup[0]), h.cup[1]], walls: h.walls.map(([x, y, w, hh, a]) => [r3h(100 - x), y, w, hh, r3h(-(a || 0))]), bumpers: h.bumpers.map(([x, y, r]) => [r2h(100 - x), y, r]), path: h.path.map(([x, y]) => [r2h(100 - x), y]) });
  const shape = h => JSON.stringify([h.walls.map(w => w.map(r2h).join()).sort(), h.bumpers.map(b => b.map(r2h).join()).sort(), h.cup.map(r2h)]);
  const HOLES = LAYOUTS.map((h, i) => Object.assign({}, h, { of: i }));
  LAYOUTS.forEach((h, i) => { const m = mirror(h); if (shape(m) !== shape(h)) HOLES.push(Object.assign(m, { of: i })); });
  const SIZES = { golf: GOLF, pool: POOL, bowling: BOWL };
  const RUN_OPT = ['holeSpeed', 'kick', 'vMax'];

  const wall = (x, y, w, h, angle, label) => Bodies.rectangle(x, y, w, h, { isStatic: true, angle: angle || 0, restitution: 0.72, friction: 0, label: label || 'wall' });
  const edges = (w, h, t) => [wall(w / 2, -t / 2, w + 2 * t, t), wall(w / 2, h + t / 2, w + 2 * t, t), wall(-t / 2, h / 2, t, h + 2 * t), wall(w + t / 2, h / 2, t, h + 2 * t)];
  const ball = (x, y, r, label, o) => Bodies.circle(x, y, r, Object.assign({ restitution: 0.88, friction: 0.01, frictionStatic: 0, density: 0.01, label }, o || {}));
  const speed = b => Math.hypot(b.velocity.x, b.velocity.y);

  // The world of a shot: the table's bodies, the balls (or the ball and the pins) at their current places.
  function build(type, pos) {
    const engine = Engine.create({ gravity: { x: 0, y: 0 }, positionIterations: 8, velocityIterations: 8 });
    const S = SIZES[type], bodies = [], tracked = [];
    if (type === 'golf') {
      const hole = HOLES[pos.hole];
      bodies.push(...edges(S.w, S.h, 8));
      for (const [x, y, w, h, a] of hole.walls) bodies.push(wall(x, y, w, h, a));
      hole.bumpers.forEach(([x, y, r], k) => bodies.push(Bodies.circle(x, y, r, { isStatic: true, restitution: 0.9, friction: 0, label: 'bumper:' + k })));
      for (const p of ['X', 'O']) if (!pos.holed[p]) { const b = ball(pos.balls[p][0], pos.balls[p][1], S.ballR, 'ball:' + p, { frictionAir: S.air }); bodies.push(b); tracked.push([p, b]); }
    } else if (type === 'pool') {
      bodies.push(...edges(S.w, S.h, 8));
      const rank = id => (id === 'cue' ? 0 : id === 'black' ? 3 : id[0] === 'x' ? 1 : 2);   // (the order engine.js keeps: poolIds)
      for (const id of Object.keys(pos.balls).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'en', { numeric: true }))) if (!pos.down[id]) { const b = Bodies.polygon(pos.balls[id][0], pos.balls[id][1], S.sides, S.ballR, { restitution: S.bounce, friction: 0.01, frictionStatic: 0, density: 0.01, label: 'ball:' + id, frictionAir: S.air }); bodies.push(b); tracked.push([id, b]); }
    } else {
      // no back wall: the end of the lane is a pit (below), and the sides are gutters (nothing to bounce off)
      const b = ball(S.start[0], S.start[1], S.ballR, 'ball:ball', { frictionAir: S.air, density: S.ballDensity || 0.03 });
      bodies.push(b); tracked.push(['ball', b]);
      S.pins.forEach(([x, y], k) => { if (pos && pos.standing && !pos.standing[k]) return; const pin = ball(x, y, S.pinR, 'pin:' + k, { frictionAir: S.pinAir, density: S.pinDensity || 0.02, restitution: S.pinBounce, friction: 0.05 }); bodies.push(pin); tracked.push(['p' + k, pin]); });   // (standing: a second roll at what the first left)
    }
    Composite.add(engine.world, bodies);
    return { engine, tracked, S };
  }

  // A shot, played out: the shooter's ball is sent off at its aim and power; everything runs until it
  // all stops (or the time is up). Returns the final places, what happened, and the recording.
  // (Super Chaos's Mini Golf: shooter is { X: shot, O: shot } and both balls are struck at once.)
  // opt: a square's own settings over the table's (RUN_OPT: Mini Golf's holeSpeed and kick, the others' vMax).
  function run(type, pos, shooter, shot, opt) {
    const { engine, tracked } = build(type, pos), S = opt ? Object.assign({}, SIZES[type]) : SIZES[type];
    if (opt) for (const k of RUN_OPT) if (Number.isFinite(opt[k])) S[k] = opt[k];
    const byId = Object.fromEntries(tracked);
    const shots = shooter && typeof shooter === 'object' ? shooter : { [type === 'golf' ? shooter : type === 'pool' ? 'cue' : 'ball']: shot };
    const movers = Object.keys(shots).filter(id => byId[id] && shots[id]);
    if (!movers.length) return null;
    for (const id of movers) {
      const power = Math.max(0, Math.min(1, Number(shots[id].power) || 0)), aim = Number(shots[id].aim) || 0, v0 = Math.pow(power, S.curve || 1) * S.vMax;
      Body.setVelocity(byId[id], { x: Math.sin(aim) * v0 / 60, y: -Math.cos(aim) * v0 / 60 });   // (Matter's velocity is per step at 60 Hz, whatever the step's length)
    }
    const events = [], gone = {}, flags = {}, kicks = [], meets = [];
    let t = 0, hitPin = false;
    const ev = (k, extra) => { if (events.length < 60 || (k !== 'balls' && k !== 'wall' && k !== 'pin')) events.push(Object.assign({ t: r2(t / TS), k }, extra || {})); };   // (the time as it plays: see TS; the bounces stop being noted after 60 events, what a result is read from never does)
    Events.on(engine, 'collisionStart', e => {
      for (const pair of e.pairs) {
        const a = pair.bodyA.label, b = pair.bodyB.label, v = Math.max(speed(pair.bodyA), speed(pair.bodyB)) * 60;
        if (type === 'golf' && (a.startsWith('bumper:') || b.startsWith('bumper:'))) {   // a bumper: it kicks the ball straight off it, faster than it came (a flash and a pop on screen)
          const bump = a.startsWith('bumper:') ? pair.bodyA : pair.bodyB, bl = bump === pair.bodyA ? pair.bodyB : pair.bodyA;
          if (!bl.label.startsWith('ball:')) continue;
          kicks.push({ bl, bump });                                  // (the kick itself once the step is solved: set now, the collision's own response would take most of it back)
          ev('bump', { b: Number(bump.label.slice(7)), id: bl.label.slice(5) });
          continue;
        }
        if (a.startsWith('pin') || b.startsWith('pin')) hitPin = true;
        if (type === 'pool' && a.startsWith('ball:') && b.startsWith('ball:')) meets.push([pair.bodyA, pair.bodyB]);   // (Pool: two balls touching: their speeds are set from the line through their centres once the step is solved, below)
        if (v < (S.evMin || 4)) continue;
        const kind = a.startsWith('ball') && b.startsWith('ball') ? 'balls' : (a.startsWith('pin') || b.startsWith('pin')) ? 'pin' : 'wall';
        const last = events[events.length - 1];
        if (last && last.k === kind && t / TS - last.t < 0.08) continue;
        ev(kind, { v: Math.round(v) });
      }
    });
    const frames = [], ids = tracked.map(x => x[0]);
    const frame = () => frames.push(tracked.map(([id, b]) => (gone[id] ? [null, null] : [r1(b.position.x), r1(b.position.y)])).flat());
    const remove = (id, k, extra) => { gone[id] = true; Composite.remove(engine.world, byId[id]); ev(k, Object.assign({ id }, extra || {})); };
    frame();
    let still = 0, step = 0;
    const maxSteps = Math.round(S.maxT * 1000 / STEP), sub = S.sub || 1, dt = STEP / sub;   // (sub-steps: Pool's fast balls move less than a sixth of their width each one)
    while (step < maxSteps) {
     for (let q = 0; q < sub; q++) {
      const was = type === 'golf' ? new Map(tracked.map(([, b]) => [b, speed(b) * 60])) : null;   // (each ball's speed as it came: a kick goes by that)
      const pre = type === 'pool' ? new Map(tracked.map(([, b]) => [b, { x: b.velocity.x, y: b.velocity.y }])) : null;   // (Pool: each ball's velocity as it came into the step)
      Engine.update(engine, dt); t = (step + (q + 1) / sub) * STEP / 1000;
      for (const [A, B] of meets.splice(0)) {                        // Pool: two balls met in this step: off each other as circles
        const va = pre.get(A), vb = pre.get(B);
        if (!va || !vb) continue;
        const k = dt / (1000 / 60), wx = (vb.x - va.x) * k, wy = (vb.y - va.y) * k;   // (how far they closed in the step)
        let rx = B.position.x - A.position.x, ry = B.position.y - A.position.y;
        const w2 = wx * wx + wy * wy, rw = rx * wx + ry * wy, c = rx * rx + ry * ry - 4 * S.ballR * S.ballR;
        if (w2 > 1e-12 && c < 0) { const back = Math.min(2, (rw + Math.sqrt(rw * rw - w2 * c)) / w2); rx -= wx * back; ry -= wy * back; }   // back to where they first touched: the line through their centres there
        const d = Math.hypot(rx, ry) || 1, nx = rx / d, ny = ry / d, vn = (va.x - vb.x) * nx + (va.y - vb.y) * ny;
        if (vn <= 0) continue;                                       // (not closing: nothing to do)
        const j = (1 + S.bounce) / 2 * vn;
        va.x -= j * nx; va.y -= j * ny; vb.x += j * nx; vb.y += j * ny;   // (kept in pre: a ball that met two in the one step goes on from the first)
        Body.setVelocity(A, va); Body.setVelocity(B, vb);
        Body.setAngularVelocity(A, 0); Body.setAngularVelocity(B, 0);
      }
      for (const { bl, bump } of kicks.splice(0)) {                  // Mini Golf's bumpers: straight off, kickKeep of the speed it came at and kick more
        const n = { x: bl.position.x - bump.position.x, y: bl.position.y - bump.position.y }, d = Math.hypot(n.x, n.y) || 1, out = Math.min(S.kickMax, (was.get(bl) || 0) * S.kickKeep + S.kick) / 60;
        Body.setVelocity(bl, { x: (n.x / d) * out, y: (n.y / d) * out });
      }
      for (const [id, b] of tracked) {                            // rolling resistance: a steady slowing, so balls stop instead of trickling on
        if (gone[id]) continue;
        const v = speed(b), dv = (id[0] === 'p' ? S.pinRoll + (S.pinGrip && v * 60 < S.pinSlow ? S.pinGrip : 0) : S.roll) * dt / 1000 / 60;   // (Bowling: a pin that has slowed to a slide grinds to a halt, pinGrip more under pinSlow)
        if (v > 0) { const f = Math.max(0, v - dv) / v; Body.setVelocity(b, { x: b.velocity.x * f, y: b.velocity.y * f }); }
      }
      // the table's own rules, checked every step
      if (type === 'golf') {
        const cup = HOLES[pos.hole].cup;
        for (const [id, b] of tracked) {
          if (gone[id]) continue;
          const d = Math.hypot(b.position.x - cup[0], b.position.y - cup[1]), v = speed(b) * 60;
          if (d < S.cupR) {
            if (v <= S.holeSpeed && !flags[id]) { remove(id, 'hole'); }
            else if (!flags[id]) {                                 // (after a lip-out the ball must leave the cup before it can drop)                                 // too fast: it lips out, sent off sideways and slowed
              flags[id] = true;
              const n = Vector.normalise({ x: b.position.x - cup[0] || 0.01, y: b.position.y - cup[1] });
              const vel = b.velocity, dot = vel.x * n.x + vel.y * n.y;
              Body.setVelocity(b, { x: (vel.x - 1.6 * dot * n.x) * S.lipKick, y: (vel.y - 1.6 * dot * n.y) * S.lipKick });
              ev('lip', { id });
            }
          } else if (d > S.cupR + 2) flags[id] = false;
        }
      } else if (type === 'pool') {
        for (const [id, b] of tracked) {
          if (gone[id]) continue;
          if (S.pockets.some(([px, py, pr]) => Math.hypot(b.position.x - px, b.position.y - py) < pr)) remove(id, 'pocket');
        }
      } else {
        for (const [id, b] of tracked) {
          if (gone[id]) continue;
          const pit = b.position.y < S.pit, off = b.position.y > S.h + 6 || b.position.x < -6 || b.position.x > S.w + 6;
          if (id === 'ball') { if (pit || off || b.position.x < S.gutter || b.position.x > S.w - S.gutter) remove(id, pit ? 'end' : 'gutter'); }
          else if (pit) remove(id, 'pit');                         // a pin past the end of the lane: into the pit, gone (down)
          else if (off) remove(id, 'off');
          else if (S.fall && !flags[id]) {                         // a pin knocked off its spot is a pin lying down: it sweeps a wider path from here on (fall times its width), as a fallen pin does, and takes its neighbours with it
            const k = Number(id.slice(1)), [sx, sy] = S.pins[k];
            if (Math.hypot(b.position.x - sx, b.position.y - sy) > S.knocked) { flags[id] = true; const m = b.mass; Body.scale(b, S.fall, S.fall); Body.setMass(b, m); }
          }
        }
      }
     }
      step++; t = step * STEP / 1000;
      if (step % SUB === 0) frame();
      const moving = tracked.some(([id, b]) => !gone[id] && speed(b) * 60 > (S.still || 0.9));   // (a pin still wobbling along slowly is as good as down)
      still = moving ? 0 : still + 1;
      if (still >= 24 && step > 30) break;
    }
    if (step % SUB !== 0) frame();
    for (const [id, b] of tracked) if (!gone[id]) Body.setVelocity(b, { x: 0, y: 0 });
    const final = {};
    for (const [id, b] of tracked) final[id] = gone[id] ? null : [r2(b.position.x), r2(b.position.y)];
    let result;
    if (type === 'golf') result = { holed: { X: !!gone.X, O: !!gone.O }, first: (events.find(e => e.k === 'hole') || {}).id || null };
    else if (type === 'pool') result = { pocketed: events.filter(e => e.k === 'pocket').map(e => e.id) };
    else {
      const was = pos && pos.standing ? pos.standing : null;        // (pins down before this roll stay down and count for nothing)
      const down = BOWL.pins.map(([x, y], k) => (was && !was[k]) || gone['p' + k] || Math.hypot(final['p' + k][0] - x, final['p' + k][1] - y) > S.knocked);
      result = { down, knocked: down.filter((d, k) => d && !(was && !was[k])).length, gutter: !hitPin && events.some(e => e.k === 'gutter') };   // a gutter ball: one that never reached the pins
    }
    ev('stop');
    return { final, events, rec: { fps: FPS * TS, ids, frames }, result, ms: Math.round(frames.length / (FPS * TS) * 1000) };
  }

  // ---------- Pinball: a portrait table, played live on the phone (or by the computer's hand) ----------
  // (Reworked November 2026, CLIENT_VERSION 1.13.0.) Units as the other tables: 100 across, 180 tall, y down.
  // Pinball no longer runs on Matter.js: the ball against the table is worked out here, in fixed steps of
  // plain arithmetic (+, -, *, / and sqrt; the flippers' angles through dsin/dcos below, never Math.sin),
  // so the same inputs make exactly the same ball on every phone and on the server, and another phone
  // replays a ball from its inputs alone. At 480 steps a second nothing moves more than a third of the
  // ball's width in a step (the ball at its fastest 0.92 units, a flipper's tip 1.05), so the ball never
  // passes through a wall or a flipper; every contact pushes the ball exactly out of what it touched and
  // turns its speed about the contact's normal (a slow contact, under restV, without any bounce: the ball
  // rolls along a rail, sits on a held flipper, and never jitters).
  //
  // The table, as a real one is laid out. The frame is the same on every table: the plunger lane up the
  // right side; the arch, a true half circle over the top (the ball rides it without a bump); the one-way
  // gate at the lane's top (a launch passes up through it, a ball coming back down the arch is turned onto
  // the right orbit); the arch stop, a one-way flap at the top left hanging from the arch to the first lane
  // guide (a launched ball that runs the whole arch meets it and drops into the top lanes; a ball shot up
  // the left orbit passes under it, over the top and down the right side); and the lower playfield: the two
  // flippers low down with a drain gap between their tips, an inlane and an outlane above each (the guide
  // feeds the inlane's ball onto the flipper; the outlane drains beside it), a slingshot above each inlane,
  // and an outlane guard on each side wall that turns a ball running down the wall in over the slingshot.
  // The upper playfield is one of PIN_LAYOUTS: top rollover lanes under the arch, pop bumpers under them,
  // orbit lanes up the sides, standup targets facing the flippers. A square's targets are seven of its
  // layout's spots (mini.table: { k, t }); each player lights their own.
  //
  // The launch is a skill shot: the pull sets the speed (lane.lo to lane.hi). Every launch runs the arch over
  // the top to the stop and comes back off it, the further the harder it was launched: a soft pull drops
  // the ball into the first (left) top lane, a middling one (and a tap) into the second, a firm one into the
  // third, a full one beyond (the fourth lane where the table has one), each about a fifth of the pull wide;
  // from the lanes it falls into the bumpers. The speed goes with the square root of the table's gravity
  // setting, so the path is the same at any slope. A ball that drains in the first save seconds after its
  // launch is saved: it comes back to the plunger and the table launches it again itself.
  //
  // The flippers: a flipper speeds up as it swings (acc, to speed at most) and stops dead at the top. A ball
  // lying or rolling on it rides the swing (each step's push is below restV: no bounce) and leaves as the
  // flipper stops, with the surface's speed at that point: slow off the base (a short backhand up its own
  // side), fast off the tip (across the table), its direction turning smoothly from one to the other along
  // the flipper; a ball that meets a flipper already moving is struck (e). A held flipper cradles the ball
  // against the inlane guide; let go, the ball rolls down the flipper for an aimed shot.
  const PIN = {
    w: 100, h: 180, ballR: 2.6, g: 300, hz: 480, fps: 30, vmax: 440, drain: 177, wall: 0.42, restV: 32, drag: 0.07,
    maxSecs: 30,                  // a ball's time limit from Start, by default (pinball/meta.js TUNE maxSecs: the same default; a square's own in mini.tune)
    mid: 45.9,                    // the playfield's middle (between the left wall and the lane's wall)
    arc: { cx: 50, cy: 51, r: 49, t: 2.4 },   // the arch: a half circle over the top, from the left wall round to the right
    flip: { len: 20.5, rb: 2.3, rt: 1.3, thick: 4.6, rest: 0.48, up: -0.48, acc: 1500, speed: 24, accBack: 600, back: 12, e: 0.3, restV: 50, grip: 0.3, early: 0.8, late: 0.6, hold: 0.22, lob: 0.052, fling: 0.54, s0: 250, s1: 440, L: [22.4, 165], R: [69.4, 165] },   // tapered: rb at the pivot, rt at the tip; the tips at rest 10.6 apart (8 clear: a ball and a half); acc and speed: the swing (48 ms); early, late, hold, lob, fling, s0, s1: the strike (pinFlipHit)
    lane: { x0: 92, x1: 97.8, wall: 90.8, top: 52, serve: [94.9, 168], gate: [90.8, 52, 97.5, 39.2, 2], lo: 330, hi: 374, tap: 0.54, again: 0.7 },   // the plunger lane, its wall, the one-way gate from the wall's top up to the arch, the launch speeds (units a second), a tap's power, and how long after a save the table launches the ball again itself
    stop: [24, 9.47, 31, 17, 2],  // the arch stop: a one-way flap from the arch down to the first lane guide's top
    stopE: 0.5,                   // and its bounce: a launched ball comes back off it the further the harder it was launched (the skill shot)
    bump: { r: 5, kick: 175, e: 0.5 },
    sling: { kick: 150, lift: -0.1 },   // a slingshot's kick off its long face, and how much of it goes up the table as well
    stand: { e: 0.45 },
    spin: { r: 9, w: 1.7 },       // a moving target: it slides this far either side of its middle, at this speed (radians a second, times the spin setting)
    targets: null,                // the classic seven (layout 0's first seven spots): a square from before the layouts plays on them; filled in below
  };
  // Sine and cosine by arithmetic alone (the same to the last bit on every engine): the angle brought
  // within a quarter turn, then the series.
  const dsin = a0 => {
    const TAU = 6.283185307179586, PI = 3.141592653589793;
    let a = a0 - TAU * Math.floor((a0 + PI) / TAU);
    if (a > PI / 2) a = PI - a; else if (a < -PI / 2) a = -PI - a;
    const x = a * a;
    return a * (1 - x / 6 * (1 - x / 20 * (1 - x / 42 * (1 - x / 72 * (1 - x / 110 * (1 - x / 156 * (1 - x / 210)))))));
  };
  const dcos = a => dsin(a + 1.5707963267948966);
  // A polyline as thick wall segments [x1, y1, x2, y2, thickness], joined end to end.
  const pinPoly = (t, ...pts) => pts.slice(1).map((p, i) => [pts[i][0], pts[i][1], p[0], p[1], t]);
  const pinMir = x => Math.round((2 * PIN.mid - x) * 100) / 100;   // a place mirrored across the playfield's middle
  // The outside as a polygon (for the drawing and the tests): the left side, the arch (a point every 6
  // degrees), the right side, the bottom (below the drain line: the ball is gone before it gets there).
  const PIN_ARCH = Array.from({ length: 31 }, (_, i) => { const a = Math.PI - (i * Math.PI) / 30; return [Math.round((PIN.arc.cx + PIN.arc.r * Math.cos(a)) * 100) / 100, Math.round((PIN.arc.cy - PIN.arc.r * Math.sin(a)) * 100) / 100]; });
  const PIN_OUTER = [[1, 181.2]].concat(PIN_ARCH, [[99, 181.2], [1, 181.2]]);
  // The frame, on every table: the side and bottom walls, the plunger lane's wall, the first top lane's
  // guide (the arch stop ends on its top), the outlane guards, the inlane guides and the slingshots. A
  // guide's outer side is the outlane (7 wide: a ball falls straight down it to the drain beside the
  // flipper), its inner side the inlane (6.6 wide, between the guide and the slingshot's outer edge); at
  // the bottom the guide bends in to the flipper's pivot, its end buried in the pivot's disc, so the
  // inlane's ball rolls off the guide onto the flipper and nothing can slip behind the flipper. The
  // slingshots are a triangle each above the inlane; the long face (towards the middle) kicks. The outlane
  // guards: a rail from each side wall above the outlane, sloping down towards the middle and reaching in over
  // the inlane to above the slingshot's top, so a ball running down a side wall (out of an orbit lane), or
  // falling from the playfield above, lands on the guard and drops off its end onto the slingshot's face,
  // never onto the lanes; the inlane and the outlane are entered from the side, through the window between
  // the guard's end and the slingshot's top (a ball and a quarter tall), and the outlane only by a ball that
  // then goes on up over the guide's cap (the guide's top leans out towards the wall: a ball landing on it
  // from the playfield side rolls back into the inlane). A slingshot kicks a little down the table
  // (sling.lift, negative: a ball passed from one slingshot to the other works its way down to the flippers,
  // never up and out). So no launch feeds an outlane before a flipper could reach the ball (0 of 4,200:
  // tests/sim/pinball-launch.sim.js), outlanes take about one drain in fifteen, and a ball that does go down
  // one before any flipper has touched it since its launch comes back (pinStep: saved, `out`). Nothing here makes a pocket a ball can rest in
  // (pinLayoutCheck's pocket rule), and nothing on a layout may come within a unit of any of it.
  const PIN_FRAME = {
    walls: [
      [1, 51, 1, 181.2, 2.4], [1, 181.2, 99, 181.2, 2.4], [99, 181.2, 99, 51, 2.4],
      [PIN.lane.wall, 181.2, PIN.lane.wall, PIN.lane.top, 2.4],
      [31, 17, 31, 27, 2.4],
      [1, 106, 18.5, 118.1, 2.4], [PIN.lane.wall, 106, pinMir(18.5), 118.1, 2.4],
      ...pinPoly(2.4, [9, 121.2], [10.4, 124.5], [10.4, 150], [21.4, 162.6]), ...pinPoly(2.4, [pinMir(9), 121.2], [pinMir(10.4), 124.5], [pinMir(10.4), 150], [pinMir(21.4), 162.6]),
    ],
    slings: [[[18.2, 126], [18.2, 144.5], [24.5, 151]], [[pinMir(18.2), 126], [pinMir(18.2), 144.5], [pinMir(24.5), 151]]],   // (the lower corner well clear of a ball riding the flipper's base up: nothing pinches)
  };
  const PIN_LOWER = PIN_FRAME;   // (its old name)
  // The upper playfields. Each: its walls (lane guides and rails, all above y 120), its pop bumpers, and its
  // spots: a spot is a place a target can be dealt at. { x, y, r, name, kind }: kind 'roll' a rollover (a
  // light in a lane: nothing to bounce off, lit as the ball passes over it), 'stand' a standup target (a
  // round post the ball bounces off, lit by the touch; mount: on a rail's face, so it may overlap that
  // rail); { spin: [cx, cy] } a standup that slides from side to side. r is the target's size before the
  // admin's size setting (up to twice). A square's seven targets are seven of the spots. Every spot keeps
  // clear of everything else at any size, leaves room for the ball to reach it and makes no pocket with
  // anything; pinLayoutCheck holds every layout to that in the tests, and the computer's hand lights every
  // spot in the simulations (tests/sim/pinball.sim.js: pinReach), so any seven can be dealt.
  const pinLanes = (...xs) => xs.map(x => [x, 17, x, 27, 2.4]);   // top lane guides (the first, at 31, is the frame's)
  const ROLL = (x, y, name) => ({ x, y, r: 2, name, kind: 'roll' });
  const STAND = (x, y, name, mount) => Object.assign({ x, y, r: 1.7, name, kind: 'stand' }, mount ? { mount: true } : {});
  const IN_L = ROLL(14.8, 137, 'Left inlane'), IN_R = ROLL(pinMir(14.8), 137, 'Right inlane');
  const PIN_LAYOUTS = [
    { name: 'Classic',                                                   // three top lanes, three bumpers under them, an orbit lane up each side behind a rail, targets on the rails' faces
      walls: [...pinLanes(41, 51, 61), [13, 62, 13, 98, 2.4], [pinMir(13), 62, pinMir(13), 98, 2.4]],
      bumpers: [[36, 45], [56, 45], [46, 59]],
      spots: [ROLL(36, 22, 'Left lane'), ROLL(46, 22, 'Centre lane'), ROLL(56, 22, 'Right lane'), ROLL(7.6, 80, 'Left orbit'), ROLL(pinMir(7.6), 80, 'Right orbit'), Object.assign(STAND(15, 90, 'Left target', true), { r: 2.1 }), Object.assign(STAND(pinMir(15), 90, 'Right target', true), { r: 2.1 }),
        STAND(46, 82, 'Centre target'), IN_L, IN_R, STAND(26, 98, 'Lower left target'), STAND(pinMir(26), 98, 'Lower right target')] },
    { name: 'Target bank',                                               // a roof across the middle with a bank of three targets under it, facing the flippers; two bumpers above
      walls: [...pinLanes(41, 51, 61), ...pinPoly(2.4, [31, 80], [46, 74], [61, 80])],
      bumpers: [[35, 47], [57, 47]],
      spots: [STAND(38, 79.3, 'Bank left', true), STAND(46, 76.2, 'Bank middle', true), STAND(54, 79.3, 'Bank right', true), ROLL(36, 22, 'Left lane'), ROLL(46, 22, 'Centre lane'), ROLL(56, 22, 'Right lane'),
        ROLL(46, 60, 'Over the bank'), ROLL(8, 84, 'Left side'), ROLL(pinMir(8), 84, 'Right side'), IN_L, IN_R, STAND(14, 60, 'Left post'), STAND(pinMir(14), 60, 'Right post')] },
    { name: 'Bumper nest',                                               // four bumpers in a diamond, a sliding target under them, a kicker rail off each side wall
      walls: [...pinLanes(41, 51, 61), [2, 66, 12, 76, 2.4], [PIN.lane.wall - 1, 66, pinMir(12), 76, 2.4]],
      bumpers: [[46, 41], [33, 53], [59, 53], [46, 65]],
      spots: [ROLL(36, 22, 'Left lane'), ROLL(46, 22, 'Centre lane'), ROLL(56, 22, 'Right lane'), { spin: [46, 88], r: 1.9, name: 'Slider', kind: 'stand' }, ROLL(46, 76, 'Under the nest'), STAND(16, 92, 'Left target'), STAND(pinMir(16), 92, 'Right target'),
        ROLL(10, 52, 'Left orbit'), ROLL(pinMir(10), 52, 'Right orbit'), IN_L, IN_R, STAND(24, 72, 'Left of the nest'), STAND(pinMir(24), 72, 'Right of the nest')] },
    { name: 'Four lanes',                                                // four top lanes, two bumpers, a rail slanting in from each side with a target on its face, a centre post
      walls: [...pinLanes(41, 51, 61, 71), ...pinPoly(2.4, [12, 56], [22, 84]), ...pinPoly(2.4, [pinMir(12), 56], [pinMir(22), 84])],
      bumpers: [[38, 47], [58, 47]],
      spots: [ROLL(36, 22, 'First lane'), ROLL(46, 22, 'Second lane'), ROLL(56, 22, 'Third lane'), STAND(18.5, 69, 'Left rail', true), STAND(pinMir(18.5), 69, 'Right rail', true),
        STAND(46, 70, 'Centre post'), ROLL(8, 92, 'Left orbit'), ROLL(pinMir(8), 92, 'Right orbit'), IN_L, IN_R, ROLL(48, 47, 'Between the bumpers'), STAND(46, 94, 'Low post')] },
  ];
  const PIN_CLASSIC = [0, 1, 2, 3, 4, 5, 6];   // the classic seven: layout 0's first spots, for a square dealt before the layouts (no mini.table)
  // A target from a spot: its id (its place in the square's seven), its size at the admin's size setting,
  // its kind, and for a moving one its track.
  const pinSpot = (s, id, size) => (s.spin ? { id, x: s.spin[0], y: s.spin[1], r: s.r * size, name: s.name, kind: 'stand', spin: { cx: s.spin[0], cy: s.spin[1], r: PIN.spin.r, w: PIN.spin.w } } : { id, x: s.x, y: s.y, r: s.r * size, name: s.name, kind: s.kind || 'stand', mount: !!s.mount, spin: null });
  PIN.targets = PIN_CLASSIC.map((i, id) => pinSpot(PIN_LAYOUTS[0].spots[i], id, 1));
  // The table of a square: the frame's walls and its layout's, its bumpers, the slingshots, its targets
  // (the square's spots, ids 0..6, at the size the square's settings give), the arch, the lane, the one-way
  // gate and stop, and the flippers. A square without a table (from before the layouts) plays the classic
  // seven on layout 0; one dealt on a layout or a spot that is no longer there (the November 2026 rework:
  // four layouts where there were seven) plays the layout and the spots its numbers come round to. The
  // same description builds the ball's world (pinNew), the drawing and the layout check.
  // A square's time limit for a ball (November 2026: its TUNE maxSecs, kept in mini.tune when not the default).
  const pinMaxSecs = mini => { const v = Number(mini && mini.tune && mini.tune.maxSecs); return Number.isFinite(v) && v >= 5 && v <= 60 ? v : PIN.maxSecs; };
  function pinTable(mini) {
    const cfg = (mini && mini.cfg) || {}, size = cfg.size || 1;
    const tb = mini && mini.table && Number.isInteger(mini.table.k) && mini.table.k >= 0 && Array.isArray(mini.table.t) ? mini.table : { k: 0, t: PIN_CLASSIC };
    const k = tb.k % PIN_LAYOUTS.length, lay = PIN_LAYOUTS[k], m = lay.spots.length, used = new Set(), spots = [];
    for (const i0 of tb.t.slice(0, m)) { let i = ((Math.floor(Number(i0)) || 0) % m + m) % m; while (used.has(i)) i = (i + 1) % m; used.add(i); spots.push(lay.spots[i]); }
    const walls = PIN_FRAME.walls.concat(lay.walls), joints = [], seen = new Set();
    walls.forEach((w, i) => { for (const [x, y] of [[w[0], w[1]], [w[2], w[3]]]) { const key = x + ',' + y + ',' + w[4]; if (seen.has(key)) continue; seen.add(key); joints.push([x, y, w[4] / 2, i < PIN_FRAME.walls.length]); } });   // every wall is a capsule: its rectangle exactly its length, a disc of half its thickness at each end (so a bend is round, flush with both faces, and no ball rests on a corner or a bump at it)
    return { k, name: lay.name, cfg, size, maxSecs: pinMaxSecs(mini), outer: PIN_OUTER, arc: PIN.arc, arch: PIN_ARCH, walls, joints, lower: PIN_FRAME.walls.length, lane: PIN.lane, gate: PIN.lane.gate, stop: PIN.stop, flip: PIN.flip, bumpers: lay.bumpers.map(([x, y]) => [x, y, PIN.bump.r]), slings: PIN_FRAME.slings, targets: spots.map((s, id) => pinSpot(s, id, size)) };
  }
  // A layout with every one of its spots as a target (for the checks and the simulations).
  const pinAllSpots = (k, cfg) => pinTable({ cfg, table: { k, t: PIN_LAYOUTS[k].spots.map((_, i) => i) } });
  // A capsule for the ball's world: the segment, its half thickness, its box (grown by the ball), how it
  // bounces and what it is. A one-way one also carries the side it stops (its normal, n).
  function pinCap(x1, y1, x2, y2, t, kind, e, extra) {
    const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy) || 1, r = t / 2, pad = r + PIN.ballR + 0.01;
    return Object.assign({ x1, y1, dx, dy, l2: dx * dx + dy * dy || 1, r, kind, e, nx: dy / len, ny: -dx / len, bx0: Math.min(x1, x2) - pad, bx1: Math.max(x1, x2) + pad, by0: Math.min(y1, y2) - pad, by1: Math.max(y1, y2) + pad }, extra || {});
  }
  // A table for one ball: its targets as they stand for the player (lit: an array of 0/1), the ball in the lane.
  function pinNew(table, cfg, lit) {
    cfg = cfg || table.cfg || {};
    const caps = [];
    for (const s of table.walls) caps.push(pinCap(s[0], s[1], s[2], s[3], s[4], 'wall', PIN.wall));
    table.slings.forEach((tri, k) => {                               // a slingshot: its three sides; the long one (first corner to last) kicks
      const mx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, my = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
      for (let i = 0; i < 3; i++) { const a = tri[i], b = tri[(i + 1) % 3], c = pinCap(a[0], a[1], b[0], b[1], 0.02, i === 2 ? 'sling' : 'wall', 0.4, { sling: k }); if ((mx - a[0]) * c.nx + (my - a[1]) * c.ny > 0) { c.nx = -c.nx; c.ny = -c.ny; } caps.push(c); }   // (n: out of the triangle)
    });
    const ones = [pinCap(...table.gate, 'gate', 0.3), pinCap(...table.stop, 'stop', PIN.stopE)];
    const circs = table.bumpers.map(([x, y, r]) => ({ x, y, r, kind: 'bumper' }));
    for (const t of table.targets) if (t.kind === 'stand') circs.push({ x: t.x, y: t.y, r: t.r, kind: 'target', t });
    const ball = { position: { x: table.lane.serve[0], y: table.lane.serve[1] }, velocity: { x: 0, y: 0 } };
    const w = { table, cfg, caps, ones, circs, ball, gateOn: false, maxSecs: table.maxSecs || 0, t: 0, acc: 0, inPlay: false, launchedAt: null, autoAt: null, touched: false, lit: (lit || []).slice(), hits: [], events: [], soft: 0, flip: { L: { a: PIN.flip.rest, w: 0, on: false }, R: { a: PIN.flip.rest, w: 0, on: false } }, over: false, saves: 0, n: 0, still: { x: 0, y: 0, t: 0 }, nudges: 0, log: [], logBits: 0, lastKnock: -1 };   // log: the inputs at their steps (the flippers' state as it changes, each launch and its power): the ball played through again from them is the same ball (pinReplay)
    return w;
  }
  const pinV = w => ({ x: w.ball.velocity.x, y: w.ball.velocity.y });          // the ball's speed, units a second
  const pinVmax = w => PIN.vmax * Math.sqrt((w.cfg && w.cfg.g) || 1);
  const pinSetV = (w, vx, vy) => { const s = Math.sqrt(vx * vx + vy * vy), m = pinVmax(w), k = s > m ? m / s : 1; w.ball.velocity.x = vx * k; w.ball.velocity.y = vy * k; };
  const pinEv = (w, k, extra) => { if (w.events.length < 4000) w.events.push(Object.assign({ t: Math.round(w.t * 1000) / 1000, k }, extra || {})); };
  // The knocks along the way (a hard bounce off a wall, a flipper striking the ball): for the sounds only, never more
  // than one every 60 ms and 250 a ball.
  const pinKnock = (w, k, s) => { if (w.soft < 250 && w.t - w.lastKnock > 0.06) { w.soft++; w.lastKnock = w.t; pinEv(w, k, { s: Math.round(s) }); } };
  // A moving target's place, t seconds in (it slides from side to side about its middle).
  const pinSpinAt = (tg, t, cfg) => { const s = tg.spin, a = t * s.w * ((cfg && cfg.spin) != null ? cfg.spin : 1); return [s.cx + s.r * dsin(a), s.cy]; };
  function pinLight(w, id) {
    if (w.lit[id]) return;
    w.lit[id] = 1; w.hits.push({ id, t: Math.round(w.t * 1000) / 1000 }); pinEv(w, 'hit', { id });
  }
  // The ball back in the plunger lane, waiting for a launch (the gate open again).
  function pinServe(w) {
    const b = w.ball; b.position.x = w.table.lane.serve[0]; b.position.y = w.table.lane.serve[1]; b.velocity.x = 0; b.velocity.y = 0; w.inPlay = false; w.launchedAt = null; w.gateOn = false;
  }
  // A launch: power 0..1 (a tap: lane.tap). The speed goes with the square root of the gravity setting.
  function pinLaunch(w, power) {
    if (w.inPlay || w.over) return false;
    const L = w.table.lane, p = Math.round((power == null ? L.tap : Math.max(0, Math.min(1, power))) * 100) / 100;   // (the power to a hundredth: as the log keeps it, so a replay launches just the same)
    w.inPlay = true; w.launchedAt = w.t; w.autoAt = null; w.touched = false; pinSetV(w, 0, -(L.lo + (L.hi - L.lo) * p) * Math.sqrt((w.cfg && w.cfg.g) || 1)); pinEv(w, 'launch', { p });
    if (w.log.length < 20000) w.log.push([w.n, 4 + Math.round(p * 100)]);
    return true;
  }
  // A flipper's line (pivot to tip) at its angle, and its half thickness u of the way along (0..1).
  function pinFlipLine(table, side, a) { const F = (table && table.flip) || PIN.flip, [px, py] = F[side], s = side === 'L' ? 1 : -1; return [px, py, px + s * F.len * dcos(a), py + F.len * dsin(a)]; }
  // The flippers' swing: held, a flipper speeds up towards the top and stops dead there; let go, it falls back.
  function pinFlipMove(w, h) {
    const F = w.table.flip || PIN.flip;
    for (const side of ['L', 'R']) {
      const f = w.flip[side];
      if (f.on) { if (f.a <= F.up) { f.w = 0; f.ride = false; continue; } f.w = Math.max(-F.speed, Math.min(f.w, 0) - F.acc * h); }
      else { f.ride = false; f.struck = false; if (f.a >= F.rest) { f.w = 0; continue; } f.w = Math.min(F.back, Math.max(f.w, 0) + F.accBack * h); }   // (let go: the next swing strikes afresh)
      const a = Math.max(F.up, Math.min(F.rest, f.a + f.w * h));
      f.w = (a - f.a) / h; f.a = a;                                  // (the last step of a swing: only as far as the stop, and its speed with it)
    }
  }
  // The ball against one flipper: a tapered capsule turning about its pivot. True when they touched.
  // A flipper on its way up carries the ball with it (the ball rides: it takes the surface's own speed) until
  // the swing has gone far enough for where the ball lies, then strikes it: a ball out at the tip is struck
  // early in the swing, while the flipper still points down (it leaves across the table, and fast); further
  // in it rides longer and leaves more nearly straight up, more slowly; over the lower half of the flipper
  // the strike comes as the flipper passes level (late) and is a lob just inside of straight up (lob: never
  // back over its own side, where the slingshot stands), slower the nearer the pivot; a ball within hold of
  // the pivot (the inlane's mouth) is only carried up, and settles in the cradle. The angle never falls as
  // the ball lies further out: the shot is set by where the ball is on the flipper, and by when the
  // flipper meets a ball coming down. One strike a swing. A flipper at rest, held up or falling back is a plain surface:
  // the ball bounces off it (not at all when it comes slowly: it rolls, or sits in the cradle).
  function pinFlipHit(w, side) {
    const F = w.table.flip || PIN.flip, f = w.flip[side], R = PIN.ballR, px = F[side][0], py = F[side][1], b = w.ball.position, v = w.ball.velocity;
    const reach = F.len + R + F.rb + 1, rx = b.x - px, ry = b.y - py;
    if (rx * rx + ry * ry > reach * reach) return false;
    const ax = (side === 'L' ? 1 : -1) * dcos(f.a), ay = dsin(f.a);
    const u0 = rx * ax + ry * ay, u = u0 < 0 ? 0 : u0 > F.len ? F.len : u0, cx = px + ax * u, cy = py + ay * u, ex = b.x - cx, ey = b.y - cy, d = Math.sqrt(ex * ex + ey * ey), rs = R + F.rb + ((F.rt - F.rb) * u) / F.len;
    const swing = f.on && f.w < 0 && !f.struck;
    if (d >= rs + (swing && f.ride ? 0.5 : 0)) return false;       // (a ball being carried stays with the flipper though a step leaves a hair between them)
    const nx = d > 1e-9 ? ex / d : 0, ny = d > 1e-9 ? ey / d : -1;
    if (d < rs) { b.x = cx + nx * rs; b.y = cy + ny * rs; }
    w.touched = true;                                                // (a flipper has had the ball since its launch)
    if (f.on && f.w < 0 && f.struck) return true;                   // (struck already this swing: the flipper only keeps the ball out of itself as it goes on up, the strike's own speed and line stand)
    const qx = cx + nx * (rs - R) - px, qy = cy + ny * (rs - R) - py;   // the touch, from the pivot
    const sx = side === 'L' ? -f.w * qy : f.w * qy, sy = side === 'L' ? f.w * qx : -f.w * qx, un = (v.x - sx) * nx + (v.y - sy) * ny;
    if (swing && (nx * sx + ny * sy > 0 || f.ride)) {               // on its way up, the ball on the side it is sweeping
      const uu = u / F.len, far = (F.rest - f.a) / (F.rest - F.up);
      if (uu < F.hold || far < Math.min(F.late, 1 - F.early * uu)) { f.ride = true; v.x = sx; v.y = sy; return true; }   // (by the pivot, in the inlane's mouth: carried up, never struck: it settles in the cradle)
      const sp = (F.s0 + (F.s1 - F.s0) * uu) * Math.min(1, Math.max(0.5, -f.w / F.speed)), k = F.fling * uu * uu, dl = Math.sqrt((nx + k * ax) * (nx + k * ax) + (ny + k * ay) * (ny + k * ay)), sg = side === 'L' ? 1 : -1;
      let dx = (nx + k * ax) / dl, dy = (ny + k * ay) / dl;
      if (dx * sg < F.lob && dy < 0) { dx = sg * F.lob; dy = -Math.sqrt(1 - F.lob * F.lob); }   // never back up its own side into the slingshot over it: the lower half of the flipper lobs the ball just inside of straight up
      pinSetV(w, dx * sp, dy * sp); f.struck = true; f.ride = false; pinKnock(w, 'knock', sp);
      return true;
    }
    if (un < 0) {
      const e = -un > F.restV ? F.e : 0, jn = -(1 + e) * un, tx = -ny, ty = nx, ut = (v.x - sx) * tx + (v.y - sy) * ty, jt = e ? Math.max(-F.grip * jn, Math.min(F.grip * jn, -ut)) : 0;   // (a real bounce: the rubber grips a little)
      v.x += jn * nx + jt * tx; v.y += jn * ny + jt * ty;
      if (-un > 110) pinKnock(w, 'knock', -un);
    }
    return true;
  }
  // How far into a flipper the ball is (over 0: touching).
  function pinFlipDepth(w, side) {
    const F = w.table.flip || PIN.flip, f = w.flip[side], px = F[side][0], py = F[side][1], b = w.ball.position, ax = (side === 'L' ? 1 : -1) * dcos(f.a), ay = dsin(f.a), rx = b.x - px, ry = b.y - py;
    const u0 = rx * ax + ry * ay, u = u0 < 0 ? 0 : u0 > F.len ? F.len : u0, ex = rx - ax * u, ey = ry - ay * u;
    return PIN.ballR + F.rb + ((F.rt - F.rb) * u) / F.len - Math.sqrt(ex * ex + ey * ey);
  }
  // The ball against everything that stands still (and the moving target): the arch, the walls, the
  // slingshots, the one-way gate and stop, the bumpers and the standup targets. True when it touched anything.
  function pinStatics(w) {
    const R = PIN.ballR, b = w.ball.position, v = w.ball.velocity, A = w.table.arc || PIN.arc;
    let hit = false;
    if (b.y < A.cy) {                                                // the arch: the ball inside a half circle
      const dx = b.x - A.cx, dy = b.y - A.cy, lim = A.r - A.t / 2 - R, d2 = dx * dx + dy * dy;
      if (d2 > lim * lim) {
        const d = Math.sqrt(d2), nx = -dx / d, ny = -dy / d, vn = v.x * nx + v.y * ny;
        b.x = A.cx + (dx * lim) / d; b.y = A.cy + (dy * lim) / d; hit = true;
        if (vn < 0) { const sp = Math.sqrt(v.x * v.x + v.y * v.y), e = -vn < PIN.restV || -vn < 0.5 * sp ? 0 : PIN.wall; v.x -= (1 + e) * vn * nx; v.y -= (1 + e) * vn * ny; if (e && -vn > 150) pinKnock(w, 'wall', -vn); }   // (a glancing ball rides the arch: no bounce)
      }
    }
    for (const c of w.caps) {
      if (b.x < c.bx0 || b.x > c.bx1 || b.y < c.by0 || b.y > c.by1) continue;
      const px = b.x - c.x1, py = b.y - c.y1, u0 = (px * c.dx + py * c.dy) / c.l2, u = u0 < 0 ? 0 : u0 > 1 ? 1 : u0, ex = px - u * c.dx, ey = py - u * c.dy, d = Math.sqrt(ex * ex + ey * ey), rs = R + c.r;
      if (d >= rs) continue;
      let nx, ny;
      if (d > 1e-9) { nx = ex / d; ny = ey / d; } else { nx = c.nx; ny = c.ny; }
      b.x = c.x1 + u * c.dx + nx * rs; b.y = c.y1 + u * c.dy + ny * rs; hit = true;
      const vn = v.x * nx + v.y * ny;
      if (vn >= 0) continue;
      if (c.kind === 'sling' && u0 > 0.06 && u0 < 0.94 && -vn > 12 && w.inPlay) {   // the slingshot's long face: the ball is kicked straight off it
        const k = PIN.sling.kick, tx = v.x - vn * nx, ty = v.y - vn * ny;
        pinSetV(w, tx * 0.6 + nx * k, ty * 0.6 + ny * k - PIN.sling.lift * k); pinEv(w, 'sling', { s: c.sling });
        continue;
      }
      const e = -vn < PIN.restV ? 0 : c.e;
      v.x -= (1 + e) * vn * nx; v.y -= (1 + e) * vn * ny;
      if (e && -vn > 150) pinKnock(w, 'wall', -vn);
    }
    for (const c of w.ones) {                                        // one-way: only a ball on the stopped side, coming at it; eased out rather than thrown (a ball that fell back onto one while still through it)
      if (b.x < c.bx0 || b.x > c.bx1 || b.y < c.by0 || b.y > c.by1) continue;
      const px = b.x - c.x1, py = b.y - c.y1;
      if (px * c.nx + py * c.ny <= 0) continue;
      const u0 = (px * c.dx + py * c.dy) / c.l2, u = u0 < 0 ? 0 : u0 > 1 ? 1 : u0, ex = px - u * c.dx, ey = py - u * c.dy, d = Math.sqrt(ex * ex + ey * ey), rs = R + c.r;
      if (d >= rs || d < 1e-9) continue;
      const nx = ex / d, ny = ey / d, vn = v.x * nx + v.y * ny;
      if (vn >= 0) continue;
      const push = Math.min(rs - d, 0.4);
      b.x += nx * push; b.y += ny * push; hit = true;
      const e = -vn < PIN.restV ? 0 : c.e;
      v.x -= (1 + e) * vn * nx; v.y -= (1 + e) * vn * ny;
      if (e && -vn > 120) pinKnock(w, 'wall', -vn);
    }
    for (const c of w.circs) {
      let cx = c.x, cy = c.y;
      if (c.t && c.t.spin) { const at = pinSpinAt(c.t, w.t, w.cfg); cx = at[0]; cy = at[1]; }
      const ex = b.x - cx, ey = b.y - cy, rs = R + c.r, d2 = ex * ex + ey * ey;
      if (d2 >= rs * rs) continue;
      const d = Math.sqrt(d2), nx = d > 1e-9 ? ex / d : 0, ny = d > 1e-9 ? ey / d : -1, vn = v.x * nx + v.y * ny;
      b.x = cx + nx * rs; b.y = cy + ny * rs; hit = true;
      if (c.kind === 'bumper') {                                     // a pop bumper: the ball is kicked straight off it, whatever it came in with
        if (!w.inPlay) continue;
        const k = PIN.bump.kick * ((w.cfg && w.cfg.bump) || 1), tx = v.x - vn * nx, ty = v.y - vn * ny, out = Math.max(k, vn < 0 ? -vn * PIN.bump.e + k * 0.6 : k);
        pinSetV(w, tx * 0.5 + nx * out, ty * 0.5 + ny * out); pinEv(w, 'bump', { i: w.table.bumpers.findIndex(q => q[0] === c.x && q[1] === c.y) });
        continue;
      }
      if (c.t && w.inPlay) pinLight(w, c.t.id);
      if (vn >= 0) continue;
      const e = -vn < PIN.restV ? 0 : PIN.stand.e;
      v.x -= (1 + e) * vn * nx; v.y -= (1 + e) * vn * ny;
      if (e && -vn > 120) pinKnock(w, 'wall', -vn);
    }
    return hit;
  }
  // A frame's worth of time (ms) with the flippers held as given; returns the events of it. Only whole
  // steps are taken: what is left over is kept for the next frame (never a short step, never a step
  // dropped), so the ball's motion is the same however the frames fall and it never stutters (the drawing
  // carries the ball on by what is left over: w.acc).
  function pinRun(w, ms, input) {
    if (w.over) return [];
    const from = w.events.length, dt = 1 / PIN.hz;
    if (input) { w.flip.L.on = !!input.L; w.flip.R.on = !!input.R; }
    const bits = (w.flip.L.on ? 1 : 0) + (w.flip.R.on ? 2 : 0);
    if (bits !== w.logBits && w.log.length < 20000) { w.log.push([w.n, bits]); w.logBits = bits; }
    w.acc += Math.min(100, Math.max(0, Number(ms) || 0)) / 1000;
    while (w.acc >= dt - 1e-12 && !w.over) { w.acc -= dt; pinStep(w, dt); }
    return w.events.slice(from);
  }
  // One step of h seconds.
  function pinStep(w, h) {
    const T = w.table, L = T.lane, g = PIN.g * ((w.cfg && w.cfg.g) || 1), b = w.ball.position, v = w.ball.velocity, R = PIN.ballR;
    pinFlipMove(w, h);
    w.t += h; w.n++;
    if (!w.inPlay && w.autoAt != null && w.t >= w.autoAt) {         // a saved ball: the table launches it again itself (never an input: nothing logged)
      w.autoAt = null; w.inPlay = true; w.launchedAt = w.t; w.touched = false; pinSetV(w, 0, -(L.lo + (L.hi - L.lo) * L.tap) * Math.sqrt((w.cfg && w.cfg.g) || 1)); pinEv(w, 'launch', { p: L.tap, auto: 1 });
    }
    if (!w.inPlay) { b.x = L.serve[0]; b.y = L.serve[1]; v.x = 0; v.y = 0; }
    else {
      const k = 1 - PIN.drag * h;
      pinSetV(w, v.x * k, (v.y + g * h) * k);
      b.x += v.x * h; b.y += v.y * h;
      let pinch = false;
      for (let pass = 0; pass < 4; pass++) {                         // (again while anything was touched: a ball between two things, a flipper pressing it on a guide, is clear of both)
        let hit = pinStatics(w);
        const hl = pinFlipHit(w, 'L'), hr = pinFlipHit(w, 'R');
        if (hl || hr) hit = true;
        pinch = hl && hr;
        if (!hit) break;
      }
      if (pinch) { for (let i = 0; i < 48 && (pinFlipDepth(w, 'L') > 0 || pinFlipDepth(w, 'R') > 0); i++) b.y -= 0.25; if (v.y > -80) v.y = -80; }   // squeezed between the two tips, both swinging: up and out of the pinch
      if (!(b.x > R && b.x < PIN.w - R && b.y > R) || !(b.y >= PIN.arc.cy || (b.x - PIN.arc.cx) * (b.x - PIN.arc.cx) + (b.y - PIN.arc.cy) * (b.y - PIN.arc.cy) <= PIN.arc.r * PIN.arc.r)) {   // (never past the outside, whatever happened: the last resort, never needed in the simulations)
        b.x = Math.max(R + 3, Math.min(L.wall - R - 3, b.x)); b.y = Math.max(PIN.arc.cy, Math.min(PIN.h, b.y)); v.x *= -0.5; v.y = Math.abs(v.y) * 0.5; pinEv(w, 'guard');
      }
      if (!w.gateOn) { const gt = w.ones[0]; if ((b.x - gt.x1) * gt.nx + (b.y - gt.y1) * gt.ny > R + gt.r) { w.gateOn = true; pinEv(w, 'gate'); } }   // the ball out through the gate: it shows shut from here
      for (const t of T.targets) {                                   // the rollovers (and every target by distance: a touch is never missed)
        if (w.lit[t.id]) continue;
        let x = t.x, y = t.y;
        if (t.spin) { const at = pinSpinAt(t, w.t, w.cfg); x = at[0]; y = at[1]; }
        const dx = b.x - x, dy = b.y - y, rs = t.r + R;
        if (dx * dx + dy * dy < rs * rs && (b.x < L.wall || t.x > L.wall)) pinLight(w, t.id);   // (never from the plunger lane through its wall)
      }
      const since = w.t - w.launchedAt;
      const back = b.x > L.wall + 1.2 && b.y >= L.serve[1] && v.y > 0;   // a launch that fell back down the lane (too weak under a heavy slope): onto the plunger again
      if (b.y > PIN.drain || back) {
        const free = !back && !w.touched && (b.x < T.flip.L[0] - 8 || b.x > T.flip.R[0] + 8);   // down an outlane before a flipper has touched it: never the player's loss, the ball comes back
        const saved = back || free || since < ((w.cfg && w.cfg.save) != null ? w.cfg.save : 3);
        if (saved) { pinEv(w, back ? 'lane' : 'save', free ? { out: 1 } : {}); w.saves++; pinServe(w); if (!back) w.autoAt = w.t + PIN.lane.again; }
        else { pinEv(w, 'drain', { x: Math.round(b.x * 10) / 10 }); w.over = true; }
      }
      if (w.lit.length && w.lit.every(Boolean)) { w.over = true; pinEv(w, 'all'); }
      const sx = b.x - w.still.x, sy = b.y - w.still.y;
      if (sx * sx + sy * sy > 2.25) { w.still.x = b.x; w.still.y = b.y; w.still.t = w.t; }
      else if (w.inPlay && w.t - w.still.t > 2 && !(w.flip.L.on || w.flip.R.on) && b.x < L.wall) { const s = w.nudges++ % 2 ? 1 : -1; pinSetV(w, s * 90, -130); w.still.t = w.t; pinEv(w, 'nudge', { at: Math.round(b.x) + ',' + Math.round(b.y) }); }   // a ball at rest with no flipper held (it never happens on these tables: the layout check's pocket rule; the simulations count it): a nudge sets it going again
      if (w.inPlay && since > ((w.cfg && w.cfg.maxBall) || 120)) { pinEv(w, 'time'); w.over = true; }   // (a ball can't last for ever)
    }
    if (!w.over && w.maxSecs && w.t >= w.maxSecs - 1e-9) { pinEv(w, 'drain', { x: Math.round(w.ball.position.x * 10) / 10, cap: 1 }); w.over = true; }   // the time limit (from Start, waiting in the lane too): the ball ends as a drain would, the targets lit so far kept
  }
  // An old recording (a ball from before the rework: the ball's place 30 times a second and which flippers
  // were held, in base 36): still read, for a move made before the update.
  function pinUnpack(str) {
    if (typeof str !== 'string' || str.length > 1e6) return null;
    if (!str) return [];
    const out = [];
    for (const part of str.split(',')) {
      const m = /^([0-9a-z]{1,4})\.([0-9a-z]{1,4})(?:\.([0-3]))?$/.exec(part);
      if (!m) return null;
      out.push([parseInt(m[1], 36) / 10, parseInt(m[2], 36) / 10, m[3] ? Number(m[3]) : 0]);
    }
    return out;
  }
  // A flipper's angle along an old recording: it swings towards up or rest at its speed.
  function pinFlipAngles(frames) {
    const a = { L: PIN.flip.rest, R: PIN.flip.rest }, out = [], max = PIN.flip.speed / PIN.fps;
    for (const f of frames) { for (const [s, bit] of [['L', 1], ['R', 2]]) { const to = f[2] & bit ? PIN.flip.up : PIN.flip.rest; a[s] += Math.max(-max, Math.min(max, to - a[s])); } out.push([a.L, a.R]); }
    return out;
  }
  const pinEnd = w => (w.over ? (w.lit.every(Boolean) ? 'all' : w.events.some(e => e.k === 'time') ? 'time' : 'drain') : 'out');
  const pinResult = w => ({ hits: w.hits.map(h => [h.id, h.t]), ms: Math.round(w.t * 1000), events: w.events.filter(e => e.k !== 'guard' && e.k !== 'gate').slice(0, 600), saves: w.saves, end: pinEnd(w) });
  // The input log as a string (step gaps and values in base 36: 0-3 the flippers held, 4 + power in hundredths a
  // launch), and back; a ball played through again from one, step for step, on a fresh table: the server takes its
  // own ball's result, never the phone's (security review F3), and another phone replays the ball from the same
  // log. The steps are fixed (pinRun: whole steps of 1/hz, however the frames fall) and the inputs apply at their
  // step, so the same inputs make the same ball anywhere.
  const pinLogPack = log => { let s = 0; return log.map(([k, v]) => { const d = k - s; s = k; return d.toString(36) + ':' + v.toString(36); }).join(','); };
  function pinLogUnpack(str, maxSteps) {
    if (typeof str !== 'string' || str.length > 200000) return null;
    if (!str) return [];
    const out = [];
    let s = 0;
    for (const part of str.split(',')) {
      const m = /^([0-9a-z]{1,7}):([0-9a-z]{1,3})$/.exec(part);
      if (!m) return null;
      s += parseInt(m[1], 36); const v = parseInt(m[2], 36);
      if (s > maxSteps || v > 104 || (out.length && s < out[out.length - 1][0])) return null;
      out.push([s, v]);
    }
    return out;
  }
  // A copy of a ball's world as it stands, to try something on (the simulations: would a flip now reach the ball?):
  // the ball, the flippers and the lights its own, its events and log empty.
  const pinCopy = w => Object.assign({}, w, { ball: { position: Object.assign({}, w.ball.position), velocity: Object.assign({}, w.ball.velocity) }, flip: { L: Object.assign({}, w.flip.L), R: Object.assign({}, w.flip.R) }, lit: w.lit.slice(), hits: [], events: [], log: [], still: Object.assign({}, w.still) });
  // A ball played through again from its log, up to `steps` steps (a replay: on from where w stands, w.j the log's place).
  function pinReplayTo(w, log, steps) {
    const dt = 1 / PIN.hz;
    if (w.j == null) w.j = 0;
    while (w.n < steps && !w.over) {
      while (w.j < log.length && log[w.j][0] <= w.n) { const v = log[w.j++][1]; if (v >= 4) pinLaunch(w, (v - 4) / 100); else { w.flip.L.on = !!(v & 1); w.flip.R.on = !!(v & 2); w.logBits = v; } }
      pinStep(w, dt);
    }
    return w;
  }
  const pinReplay = (table, cfg, lit, log, steps) => pinReplayTo(pinNew(table, cfg, lit), log, steps);
  // Where along a flipper (0..1) a rolling ball should be flipped to send it at a target still unlit: for each place
  // the strike's own line (pinFlipHit's: the flipper's angle as it strikes there, its normal and the fling), and how
  // near that line passes a target; the nearest wins (null when nothing is within 5 units of any line).
  function pinAim(w, side) {
    const F = w.table.flip || PIN.flip, sg = side === 'L' ? 1 : -1, R = PIN.ballR;
    let best = null;
    for (let i = 0; i <= 22; i++) {
      const u = 0.4 + 0.025 * i, a = F.rest - Math.min(F.late, 1 - F.early * u) * (F.rest - F.up), ax = sg * dcos(a), ay = dsin(a), nx = sg * dsin(a), ny = -dcos(a), k = F.fling * u * u;
      const dl = Math.sqrt((nx + k * ax) * (nx + k * ax) + (ny + k * ay) * (ny + k * ay)), lob = (nx + k * ax) / dl * sg < F.lob, dx = lob ? sg * F.lob : (nx + k * ax) / dl, dy = lob ? -Math.sqrt(1 - F.lob * F.lob) : (ny + k * ay) / dl, px = F[side][0] + ax * u * F.len + nx * (R + F.rb), py = F[side][1] + ay * u * F.len + ny * (R + F.rb);
      for (const t of w.table.targets) {
        if (w.lit[t.id]) continue;
        const at = t.spin ? pinSpinAt(t, w.t + 0.3, w.cfg) : [t.x, t.y], along = (at[0] - px) * dx + (at[1] - py) * dy, off = Math.abs((at[0] - px) * dy - (at[1] - py) * dx);
        if (along > 12 && off < 5 && (!best || off < best.off)) best = { u, off };
      }
    }
    return best ? best.u : null;
  }
  // The pulls (0.3 to 1) that send a launched ball over a target still unlit before it comes down to the flippers: the
  // skill shot, tried on a copy of the table with no flipping (a player learns the plunger the same way).
  function pinPlunge(w) {
    const out = [];
    for (let i = 0; i <= 14; i++) {
      const c = pinNew(w.table, w.cfg, w.lit); c.t = w.t; c.maxSecs = 0;
      pinLaunch(c, 0.3 + 0.05 * i);
      for (let k = 0; k < 1100 && !c.over && c.inPlay && !c.hits.length && c.ball.position.y < 140; k++) pinStep(c, 1 / PIN.hz);
      if (c.hits.length) out.push(0.3 + 0.05 * i);
    }
    return out;
  }
  // The computer's hand: it sees the ball react seconds late. A ball coming down onto a flipper is flipped
  // at as it arrives; a ball rolling down a flipper is flipped once it has rolled as far as the hand means
  // it to (a place along the flipper it picks each time: its shots go to different parts of the table), a
  // little early or late (jitter); then it holds for a moment. A launch: a pull that sends the ball over a
  // target still unlit (pinPlunge), a little off; one launch in four (and every one when no pull does) of any strength.
  // hand.level: 'easy' is slower and looser, pulls any strength and now and then lets a ball go by; 'hard' is
  // tighter, allows for its own lateness, pulls exactly, and picks the place on the flipper that sends the
  // ball at a target still unlit (pinAim).
  function pinAi(table, cfg, lit, rng, hand) {
    hand = Object.assign({ react: [0.05, 0.09], jitter: 0.05, hold: [0.12, 0.28], launch: [0.3, 1] }, hand);   // (a square's settings over these: finger.js fingHand)
    const easy = hand.level === 'easy', hard = hand.level === 'hard', jitter = hand.jitter * (easy ? 2.2 : hard ? 0.5 : 1);
    const w = pinNew(table, cfg, lit), seen = [], react = hand.react[0] + (hand.react[1] - hand.react[0]) * rng() + (easy ? 0.06 : 0), plan = { L: null, R: null };
    const F = table.flip || PIN.flip, frame = 1000 / 60, R = PIN.ballR, ca = dcos(F.rest), sa = dsin(F.rest);
    const pick = side => { const u = hard ? pinAim(w, side) : null; return u != null ? u : 0.4 + 0.55 * rng(); }, aim = { L: pick('L'), R: pick('R') }, skip = { L: false, R: false };
    let wait = 0.6 + rng() * 0.6;
    for (let k = 0; k < 60 * 180 && !w.over; k++) {
      if (!w.inPlay) {
        wait -= frame / 1000;
        if (wait <= 0) {
          const any = hand.launch[0] + (hand.launch[1] - hand.launch[0]) * rng(), good = easy || (!hard && rng() < 0.25) ? [] : pinPlunge(w);
          pinLaunch(w, good.length ? good[Math.min(good.length - 1, Math.floor(rng() * good.length))] + (hard ? 0 : (rng() * 2 - 1) * 0.03) : any); wait = 0.5 + rng() * 0.6;
        }
      }
      const v = pinV(w);
      seen.push({ t: w.t, x: w.ball.position.x, y: w.ball.position.y, vx: v.x, vy: v.y });
      while (seen.length > 1 && seen[1].t <= w.t - react) seen.shift();
      const s = seen[0];
      for (const side of ['L', 'R']) {
        const sg = side === 'L' ? 1 : -1, rx = (s.x - F[side][0]) * sg, ry = s.y - F[side][1];
        const roll = s.vx * sg * ca + s.vy * sa, along = rx * ca + ry * sa + (hard ? Math.max(0, roll) * react : 0), above = rx * sa - ry * ca - (R + 2), fall = -(s.vx * sg * sa - s.vy * ca);   // along the resting flipper from its pivot (hard: where the ball will be by the time the hand moves); clear above its top; the speed down onto it
        const over = along > F.len * 0.12 && along < F.len + 2.5 && above > -1.5 && above < 16;
        if (!over && skip[side]) skip[side] = false;
        const due = over && w.inPlay && !skip[side] && (above < Math.max(1.2, fall * 0.045) && (fall > 45 || along >= F.len * aim[side]));
        if (!plan[side] && due) { if (easy && rng() < 0.2) skip[side] = true; else plan[side] = { at: w.t + (rng() * 2 - 1) * jitter, until: null }; }   // (easy: one ball in five goes by)
        const p = plan[side];
        if (p && p.until == null && w.t >= p.at) p.until = w.t + hand.hold[0] + (hand.hold[1] - hand.hold[0]) * rng();
        if (p && p.until != null && w.t > p.until) { plan[side] = over ? { at: w.t + 0.3 + rng() * 0.2, until: null } : null; aim[side] = pick(side); }   // (not again at once; the next shot from another place)
      }
      pinRun(w, frame, { L: !!(plan.L && plan.L.until != null && w.t <= plan.L.until), R: !!(plan.R && plan.R.until != null && w.t <= plan.R.until) });
    }
    return { w, result: pinResult(w), log: pinLogPack(w.log), steps: w.n };
  }
  // Reachability: the computer's hand plays balls on the table (every target unlit for each) and the
  // count of hits per target comes back, with the ball each was first hit on and how the balls ended.
  // The simulations run it on every layout with all its spots (every spot must be hit) and on dealt squares.
  function pinReach(table, rng, balls, hand) {
    const n = table.targets.length, hits = new Array(n).fill(0), first = new Array(n).fill(null), ends = {}, zeros = new Array(n).fill(0), drains = [];
    let ms = 0, nudges = 0;
    for (let b = 0; b < (balls || 20); b++) {
      const a = pinAi(table, table.cfg, zeros, rng, hand), r = a.result, d = r.events.find(e => e.k === 'drain');
      for (const [id] of r.hits) { hits[id]++; if (first[id] == null) first[id] = b; }
      ends[r.end] = (ends[r.end] || 0) + 1; ms += r.ms; if (d) drains.push(d.x); nudges += a.w.nudges;
    }
    return { hits, first, balls: balls || 20, ends, ms, drains, nudges };   // (drains: where each drained ball went down, its x)
  }

  // ---- the layout check: pure geometry, for the tests (pinLayoutCheck) ----
  // Every element of a table as a shape: the walls as the rectangles Matter makes of them (the segment
  // plus half the thickness past each end), the bumpers and the targets as circles (a spinner's target
  // at places round its ring), the slingshots as triangles, each flipper's sweep as capsules at angles
  // from rest to up, the lane as the rectangle the ball is served in. Returns the problems found, as
  // words: two elements closer than the clearance (1 unit), unless they are walls joined end to end or
  // at a T (or the lane and the lower table's walls, which bound it); an element outside the table; a
  // target without room for the ball to reach it (the ball touching the target, and half a unit further
  // out, clear of everything else, in some direction). An empty list: the table is sound.
  const PIN_CLEAR = 1.0;
  const segDist2 = (px, py, x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy, u = l2 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2)) : 0; return Math.hypot(px - x1 - u * dx, py - y1 - u * dy); };
  const segCross = (a, b, c, d) => {   // do the segments a-b and c-d cross?
    const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b) && o(a, b, c) !== 0 && o(c, d, a) !== 0;
  };
  const segSeg = (a, b) => (segCross([a[0], a[1]], [a[2], a[3]], [b[0], b[1]], [b[2], b[3]]) ? 0 : Math.min(segDist2(a[0], a[1], ...b), segDist2(a[2], a[3], ...b), segDist2(b[0], b[1], ...a), segDist2(b[2], b[3], ...a)));
  const inPoly = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const polyEdges = poly => poly.map((p, i) => [p[0], p[1], poly[(i + 1) % poly.length][0], poly[(i + 1) % poly.length][1]]);
  const ptPoly = (p, poly) => (inPoly(p, poly) ? 0 : Math.min(...polyEdges(poly).map(e => segDist2(p[0], p[1], ...e))));
  const rectOf = ([x1, y1, x2, y2, t]) => { const len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / (len || 1), uy = (y2 - y1) / (len || 1), hx = ux * len / 2, hy = uy * len / 2, cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, px = -uy * t / 2, py = ux * t / 2; return [[cx - hx - px, cy - hy - py], [cx + hx - px, cy + hy - py], [cx + hx + px, cy + hy + py], [cx - hx + px, cy - hy + py]]; };
  const bbFar = (a, b, m) => a.bb && b.bb && (a.bb[0] > b.bb[2] + m || b.bb[0] > a.bb[2] + m || a.bb[1] > b.bb[3] + m || b.bb[1] > a.bb[3] + m);   // two elements' boxes more than m apart
  const ptFar = (p, e, m) => e.bb && (p[0] < e.bb[0] - m || p[0] > e.bb[2] + m || p[1] < e.bb[1] - m || p[1] > e.bb[3] + m);                           // a point more than m outside an element's box
  // The distance between two shapes (0 when they overlap).
  function shapeDist(a, b) {
    if (a.kind === 'circle' && b.kind === 'circle') return Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1]) - a.r - b.r;
    if (a.kind === 'circle' && b.kind === 'poly') return ptPoly(a.c, b.poly) - a.r;
    if (a.kind === 'circle' && b.kind === 'capsule') return segDist2(a.c[0], a.c[1], ...b.seg) - a.r - b.r;
    if (a.kind === 'poly' && b.kind === 'poly') {
      if (a.poly.some(p => inPoly(p, b.poly)) || b.poly.some(p => inPoly(p, a.poly))) return 0;
      let d = Infinity; for (const e of polyEdges(a.poly)) for (const f of polyEdges(b.poly)) d = Math.min(d, segSeg(e, f)); return d;
    }
    if (a.kind === 'poly' && b.kind === 'capsule') {
      if (inPoly([b.seg[0], b.seg[1]], a.poly) || inPoly([b.seg[2], b.seg[3]], a.poly)) return -b.r;
      let d = Infinity; for (const e of polyEdges(a.poly)) d = Math.min(d, segSeg(e, b.seg)); return d - b.r;
    }
    if (a.kind === 'capsule' && b.kind === 'capsule') return segSeg(a.seg, b.seg) - a.r - b.r;
    return shapeDist(b, a);
  }
  // The elements of a table.
  function pinElements(table) {
    const els = [], F = table.flip || PIN.flip, wallSeg = (seg, i, name, lower) => ({ kind: 'poly', poly: rectOf(seg), seg, what: 'wall', name: name || `wall ${i} (${seg[0]},${seg[1]})-(${seg[2]},${seg[3]})`, lower: lower != null ? lower : i < table.lower, group: 'wall:' + i });
    table.walls.forEach((seg, i) => els.push(wallSeg(seg, i)));
    (table.arch || []).slice(1).forEach((q, i) => els.push(wallSeg([table.arch[i][0], table.arch[i][1], q[0], q[1], table.arc.t], 'arch' + i, `the arch (${table.arch[i][0]},${table.arch[i][1]})`, true)));
    els.forEach(e => { if (/^the arch \(/.test(e.name)) e.arch = true; });   // the arch, as the chords between its points (a point every 6 degrees: within 0.07 of the half circle)
    els.push(Object.assign(wallSeg(table.gate, table.walls.length, 'the gate', true), { hang: true }));
    if (table.stop) { els.push(Object.assign(wallSeg(table.stop, table.walls.length + 1, 'the arch stop', true), { hang: true })); for (const g of [[table.stop[0], table.stop[1]], [table.stop[2], table.stop[3]]]) els.push({ kind: 'circle', c: g, r: table.stop[4] / 2, seg: [g[0], g[1], g[0], g[1], table.stop[4]], what: 'wall', name: `the arch stop's end (${g[0]},${g[1]})`, lower: true, hang: true }); }
    table.joints.forEach(([x, y, r, lower], i) => els.push({ kind: 'circle', c: [x, y], r, seg: [x, y, x, y, r * 2], what: 'wall', name: `wall end ${i} (${x},${y})`, lower: !!lower }));   // (a wall's end disc: it joins the walls that end there)
    for (const g of [[table.gate[0], table.gate[1]], [table.gate[2], table.gate[3]]]) els.push({ kind: 'circle', c: g, r: table.gate[4] / 2, seg: [g[0], g[1], g[0], g[1], table.gate[4]], what: 'wall', name: `the gate's end (${g[0]},${g[1]})`, lower: true, hang: true });
    table.bumpers.forEach(([x, y, r], i) => els.push({ kind: 'circle', c: [x, y], r, what: 'bumper', name: `bumper ${i} (${x},${y})` }));
    table.slings.forEach((tri, i) => els.push({ kind: 'poly', poly: tri, what: 'sling', name: `slingshot ${i}`, lower: true }));
    for (const t of table.targets) {
      if (t.spin) for (let k = 0; k <= 12; k++) els.push({ kind: 'circle', c: [t.spin.cx + t.spin.r * (k / 6 - 1), t.spin.cy], r: t.r, what: 'target', target: t, name: `target ${t.id} "${t.name}" (on its track)`, group: 'target:' + t.id });
      else els.push({ kind: 'circle', c: [t.x, t.y], r: t.r, what: t.kind === 'roll' ? 'roll' : 'target', mount: !!t.mount, target: t, name: `target ${t.id} "${t.name}" (${t.x},${t.y})` });   // (a rollover is a light, not a thing: only the ball's room over it is checked)
    }
    for (const side of ['L', 'R']) for (let k = 0; k <= 8; k++) {   // each flipper's sweep; a flipper tapers, so its base half at the pivot's thickness and its tip half at the middle's
      const a = F.rest + (F.up - F.rest) * k / 8, [x1, y1, x2, y2] = pinFlipLine(table, side, a), mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      for (const [seg, r] of [[[x1, y1, mx, my], F.rb], [[mx, my, x2, y2], (F.rb + F.rt) / 2]]) els.push({ kind: 'capsule', seg, r, what: 'flipper', name: `flipper ${side}`, group: 'flip:' + side, lower: true, rest: k === 0, pivot: F[side] });
    }
    const ln = table.lane;
    els.push({ kind: 'poly', poly: [[ln.x0, ln.top], [ln.x1, ln.top], [ln.x1, PIN.h], [ln.x0, PIN.h]], what: 'lane', name: 'the lane', lower: true });
    for (const e of els) if (e.what === 'wall' && !e.lower) e.bounds = els.some(o => o !== e && o.what === 'wall' && o.lower && pinJoined(e, o));   // (a rail joined to the lower table's walls bounds the lane with them)
    for (const e of els) {                                           // each element's box (the checks pass over pairs whose boxes are far apart)
      const pts = e.kind === 'poly' ? e.poly : e.kind === 'circle' ? [[e.c[0] - e.r, e.c[1] - e.r], [e.c[0] + e.r, e.c[1] + e.r]] : [[e.seg[0] - e.r, e.seg[1] - e.r], [e.seg[0] + e.r, e.seg[1] + e.r], [e.seg[2] - e.r, e.seg[3] - e.r], [e.seg[2] + e.r, e.seg[3] + e.r]];
      e.bb = [Math.min(...pts.map(q => q[0])), Math.min(...pts.map(q => q[1])), Math.max(...pts.map(q => q[0])), Math.max(...pts.map(q => q[1]))];
    }
    return els;
  }
  // Two walls joined: a shared end, or an end of one buried in the other (a T: the end within the other's thickness).
  const pinJoined = (a, b) => { const e = [[a.seg[0], a.seg[1]], [a.seg[2], a.seg[3]]], f = [[b.seg[0], b.seg[1]], [b.seg[2], b.seg[3]]]; return e.some(p => segDist2(p[0], p[1], ...b.seg) <= b.seg[4] / 2 + 1e-6) || f.some(p => segDist2(p[0], p[1], ...a.seg) <= a.seg[4] / 2 + 1e-6); };
  // The places a ball could come to rest: the ball touching two elements at once (or a level top) with
  // gravity balanced by the two contacts (straight up lies between the contacts' normals: a wedge, a
  // cradle, a ball on a target's shoulder against a wall). Sampled along every element's surface at the
  // ball's distance, each sample against every other element it touches. The bumpers kick the ball off
  // and never hold it; the flippers hold it only at rest (a held flipper is the player's choice); the
  // bottom wall and the lane are where the ball waits to be served. Another target never blocks a
  // pocket here (a square deals only some of the spots), so a pocket found with every spot in place is
  // one some square could have, and a table with none has none whichever spots it deals.
  function pinPockets(els, outer) {
    const R = PIN.ballR, up = [0, -1], out = [], seen = new Set();
    const world = els.filter(e => e.what !== 'lane' && e.what !== 'roll' && !(e.what === 'wall' && e.seg[1] > PIN.h && e.seg[3] > PIN.h) && !(e.what === 'flipper' && !e.rest));   // what is there with the flippers down
    const blockers = world.filter(e => e.what !== 'target');
    const samples = e => {                                           // ball centres touching e, with the contact normal (from e into the ball); flat: on a straight side at least a ball wide (a ball could sit level on it)
      const pts = [], step = 0.3;
      const arc = (c, r, a0, a1) => { const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * r / step)); for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; pts.push([[c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)], [Math.cos(a), Math.sin(a)], false]); } };
      const side = (a, b, nx, ny, off) => { const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, m = Math.ceil(len / step); for (let k = 0; k <= m; k++) pts.push([[a[0] + dx * k / m + nx * off, a[1] + dy * k / m + ny * off], [nx, ny], len >= 2 * R]); };
      if (e.kind === 'circle') arc(e.c, e.r + R, 0, Math.PI * 2);
      else if (e.kind === 'capsule') { const [x1, y1, x2, y2] = e.seg, dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, a = Math.atan2(uy, ux); for (const s of [1, -1]) side([x1, y1], [x2, y2], -uy * s, ux * s, e.r + R); arc([x2, y2], e.r + R, a - Math.PI / 2, a + Math.PI / 2); arc([x1, y1], e.r + R, a + Math.PI / 2, a + Math.PI * 3 / 2); }
      else {
        const P = e.poly, n = P.length, area = P.reduce((s, p, i) => s + p[0] * P[(i + 1) % n][1] - P[(i + 1) % n][0] * p[1], 0), sg = area > 0 ? 1 : -1;   // the outward normal of each edge, by the polygon's winding
        for (let i = 0; i < n; i++) {
          const a = P[i], b = P[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = sg * dy / len, ny = -sg * dx / len;
          side(a, b, nx, ny, R);
          const c = P[(i + 2) % n], ex = c[0] - b[0], ey = c[1] - b[1], el = Math.hypot(ex, ey) || 1, n2x = sg * ey / el, n2y = -sg * ex / el;   // the arc round the corner at b, from this edge's normal to the next's
          let a0 = Math.atan2(ny, nx), a1 = Math.atan2(n2y, n2x); if (sg > 0 ? a1 < a0 : a1 > a0) a1 += sg * Math.PI * 2; arc(b, R, a0, a1);
        }
      }
      return pts;
    };
    const normalFrom = (p, e) => {                                   // the contact normal from e to a ball at p
      if (e.kind === 'circle') { const d = [p[0] - e.c[0], p[1] - e.c[1]], l = Math.hypot(...d) || 1; return [d[0] / l, d[1] / l]; }
      if (e.kind === 'capsule') { const [x1, y1, x2, y2] = e.seg, dx = x2 - x1, dy = y2 - y1, u = Math.max(0, Math.min(1, ((p[0] - x1) * dx + (p[1] - y1) * dy) / (dx * dx + dy * dy))), q = [x1 + u * dx, y1 + u * dy], d = [p[0] - q[0], p[1] - q[1]], l = Math.hypot(...d) || 1; return [d[0] / l, d[1] / l]; }
      let best = null;
      for (const ed of polyEdges(e.poly)) { const dx = ed[2] - ed[0], dy = ed[3] - ed[1], u = Math.max(0, Math.min(1, ((p[0] - ed[0]) * dx + (p[1] - ed[1]) * dy) / (dx * dx + dy * dy))), q = [ed[0] + u * dx, ed[1] + u * dy], d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (!best || d < best.d) best = { d, q }; }
      const d = [p[0] - best.q[0], p[1] - best.q[1]], l = Math.hypot(...d) || 1; return [d[0] / l, d[1] / l];
    };
    const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
    for (const A of world) {
      if (A.what === 'bumper') continue;
      for (const [p, nA, flat] of samples(A)) {
        if (p[1] > PIN.drain - R || (p[0] >= PIN.lane.x0 - R && p[1] > PIN.lane.top) || !inPoly(p, outer)) continue;   // (the drain, the lane, outside)
        if (!blockers.every(C => C === A || ptFar(p, C, R) || shapeDist({ kind: 'circle', c: p, r: R }, C) > -0.05)) continue;   // not a place the ball can be
        if (flat && nA[1] < -0.9995) { const key = A.name + '|level'; if (!seen.has(key)) { seen.add(key); out.push(`a ball can rest on ${A.name} (level top) at (${p[0].toFixed(1)},${p[1].toFixed(1)})`); } continue; }
        for (const B of world) {
          if (B === A || B.what === 'bumper' || (A.group && A.group === B.group) || ptFar(p, B, R + 0.2)) continue;
          const d = shapeDist({ kind: 'circle', c: p, r: R }, B);
          if (d > 0.15 || d < -0.15) continue;
          const nB = normalFrom(p, B), cr = cross(nA, nB);
          if (Math.abs(cr) < 1e-6) continue;
          const l1 = cross(up, nB) / cr, l2 = cross(nA, up) / cr;
          if (l1 < -1e-6 || l2 < -1e-6) continue;
          // balanced, but held? in a cradle the ball cannot move sideways at this height (both sides rise into
          // it); on a hilltop (the top of a bend, the far side of a rail) it can, and rolls off
          // (0.03: more than the brush a convex surface gives a ball moved 0.3 sideways, 0.3 squared over twice the ball's radius)
          const held = [-1, 1].every(dir => [A, B].some(E => shapeDist({ kind: 'circle', c: [p[0] + dir * 0.3, p[1]], r: R }, E) < -0.03));
          if (!held) continue;
          const key = [A.name, B.name].sort().join('|');
          if (!seen.has(key)) { seen.add(key); out.push(`a ball can rest on ${A.name} against ${B.name} at (${p[0].toFixed(1)},${p[1].toFixed(1)})`); }
        }
      }
    }
    return out;
  }
  // A wall ending in a flipper's pivot disc (the inlane guides), and the sweep's reach from the pivot
  // the wall must keep clear of (the disc, the wall's half thickness and the clearance).
  const PIN_PIVOT_JOIN = 4.2;
  const pinAtPivot = (w, f) => [[w.seg[0], w.seg[1]], [w.seg[2], w.seg[3]]].some(p => Math.hypot(p[0] - f.pivot[0], p[1] - f.pivot[1]) <= f.r + w.seg[4] / 2 + 1e-6);
  function pinLayoutCheck(table) {
    const els = pinElements(table), out = [], R = PIN.ballR;
    for (const e of els) {                                           // inside the table (the outside walls are its edges)
      if (e.what === 'wall' && e.lower) continue;
      const pts = e.kind === 'circle' ? [[e.c[0] - e.r, e.c[1] - e.r], [e.c[0] + e.r, e.c[1] + e.r]] : e.kind === 'poly' ? e.poly : [[e.seg[0] - e.r, e.seg[1] - e.r], [e.seg[2] + e.r, e.seg[3] + e.r]];
      if (pts.some(([x, y]) => x < 0 || x > PIN.w || y < 0 || y > PIN.h)) out.push(`${e.name} is outside the table`);
    }
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const a = els[i], b = els[j];
      if (a.group && a.group === b.group) continue;
      if (a.what === 'roll' || b.what === 'roll' || bbFar(a, b, PIN_CLEAR)) continue;
      if ((a.arch && b.hang) || (b.arch && a.hang)) continue;       // (the gate and the stop hang from the arch)
      if ((a.mount && b.what === 'wall') || (b.mount && a.what === 'wall')) continue;   // (a target on a rail's face)
      if (a.what === 'wall' && b.what === 'wall' && pinJoined(a, b)) continue;
      if ((a.what === 'lane' && (b.lower || b.bounds)) || (b.what === 'lane' && (a.lower || a.bounds))) continue;
      let d;
      if ((a.what === 'wall' && b.what === 'flipper' && pinAtPivot(a, b)) || (b.what === 'wall' && a.what === 'flipper' && pinAtPivot(b, a))) {   // a guide ending in the pivot's disc: clear of the flipper from the disc outwards
        const f = a.what === 'flipper' ? a : b, w = f === a ? b : a, [x1, y1, x2, y2] = f.seg, len = Math.hypot(x2 - x1, y2 - y1), k = PIN_PIVOT_JOIN / len;
        d = shapeDist(w, { kind: 'capsule', seg: [x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, x2, y2], r: f.r });
      } else d = shapeDist(a, b);
      if (d < PIN_CLEAR - 1e-9) out.push(`${a.name} and ${b.name} are ${d.toFixed(2)} apart (less than ${PIN_CLEAR})`);
    }
    for (const p of pinPockets(els, table.outer)) out.push(p);
    for (const t of els.filter(e => e.what === 'roll')) if (!els.every(o => o === t || o.what === 'roll' || o.what === 'lane' || shapeDist({ kind: 'circle', c: t.c, r: R }, o) >= 0)) out.push(`${t.name} has no room for the ball to roll over it`);
    for (const t of els.filter(e => e.what === 'target')) {          // room for the ball: in some direction the ball touches the target, and sits half a unit further out, clear of everything else
      const others = els.filter(e => e !== t && e.what !== 'roll' && !(e.group && e.group === t.group));
      let ok = false;
      for (let k = 0; k < 24 && !ok; k++) {
        const a = (k * Math.PI * 2) / 24, dx = Math.cos(a), dy = Math.sin(a);
        ok = [0, 0.25, 0.5].every(s => { const c = [t.c[0] + (t.r + R + s) * dx, t.c[1] + (t.r + R + s) * dy]; return c[0] > R && c[0] < PIN.w - R && c[1] > R && others.every(o => shapeDist({ kind: 'circle', c, r: R }, o) >= 0); });
      }
      if (!ok) out.push(`${t.name} has no room for the ball to reach it`);
    }
    return out;
  }

  return { GOLF, POOL, BOWL, HOLES, LAYOUTS, SIZES, FPS, TS, run, PIN, PIN_LAYOUTS, PIN_LOWER, PIN_OUTER, PIN_CLASSIC, pinTable, PIN_FRAME, pinAllSpots, pinNew, pinServe, pinLaunch, pinRun, pinStep, pinFlipLine, pinSpinAt, pinResult, pinEnd, pinAi, pinReach, pinLayoutCheck, pinV, pinSetV, pinUnpack, pinFlipAngles, pinLogPack, pinLogUnpack, pinReplay, pinReplayTo, pinCopy, dsin, dcos };
}
