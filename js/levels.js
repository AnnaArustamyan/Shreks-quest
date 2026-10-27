// Levels are strung together from hand-made chunks (bottom-aligned, 14 rows tall).
//  # ground   = block   - one-way ledge   ^ hazard (thorns / lava)
//  F flower   W treat (waffle / gold)     C checkpoint
//  e walker   b flyer   s spiky (can't be stomped)
//  M / N / n moving platforms   P start   G your love waits here
const ROWS = 14;

const CHUNKS = {
  start: `
  P      F  F
################
################`,
  flat: `
    F   F   F
################
################`,
  gap2: `
      FF
######  ######
######  ######`,
  gap3: `
       F F
      F   F
#######   ######
#######   ######`,
  arcGap: `
         F W
        ===

######       ####
######       ####`,
  stepsUp: `
           FW
          ===
     F
    ===
################
################`,
  platforms: `
         F F
        -----
   F W         F
  ----        ----

#####################
#####################`,
  walls: `
          F
         ==
    ==   ==     e
    ==   ==
#####################
#####################`,
  enemies1: `
     F     F     F
        e
#######################
#######################`,
  enemies2: `
    F    F    F    F

      e           e
########################
########################`,
  flyers: `
        b

    F   F   F
################
################`,
  flyers2: `
     b       b

   F   F   F   F
####################
####################`,
  hazard3: `
      F F F

######^^^#######
################`,
  hazard4: `
       F  F

######^^^^#######
#################`,
  hazardIsland: `
          FWF
        =====

#####^^^^^^^^^######
####################`,
  spiky: `
      F    F

   ==    s    ==
##################
##################`,
  spiky2: `
    F   F   F   F

     s       s
#####################
#####################`,
  checkpoint: `
      C
##############
##############`,
  mover: `
      F   F   F


###       M       ###
###               ###`,
  mover2: `
     F    F    W    F    F


###     N          n       ###
###                        ###`,
  bigStairs: `
              WF
             ====
          F
        ====
     F
   ====

####################
####################`,
  gauntlet: `
       F       F       F

   e      s       e      s
###############################
###############################`,
  gauntletPits: `
     F      F      F

  e      e       e
######  ######  ######  #
######  ######  ######  #`,
  goal: `
                  ==
                  ==
         G        ==
####################
####################`,
};

const LEVELS = [
  { chunks: ['start', 'flat', 'gap2', 'stepsUp', 'enemies1', 'gap3', 'walls', 'checkpoint', 'platforms', 'flyers', 'gap2', 'flat', 'goal'],
    speed: 1, need: 0.55 },
  { chunks: ['start', 'enemies1', 'hazard3', 'spiky', 'arcGap', 'flyers', 'platforms', 'checkpoint', 'bigStairs', 'walls', 'hazardIsland', 'spiky2', 'enemies2', 'goal'],
    speed: 1.15, need: 0.6 },
  { chunks: ['start', 'enemies2', 'hazard4', 'mover', 'spiky', 'flyers2', 'checkpoint', 'bigStairs', 'gauntletPits', 'mover2', 'hazardIsland', 'checkpoint', 'gauntlet', 'platforms', 'spiky2', 'arcGap', 'goal'],
    speed: 1.3, need: 0.6 },
];

const LEVEL_NAMES = {
  donkey: ['SUNNY SWAMP', 'BUZZY WOODS', 'WAFFLE HILLS'],
  dragon: ['EMBER PATH', 'KNIGHTS PASS', 'LAVA KEEP'],
};

function parseChunk(src) {
  const lines = src.replace(/^\n/, '').split('\n');
  const w = Math.max(...lines.map(l => l.length));
  const rows = lines.map(l => l.padEnd(w, ' '));
  while (rows.length < ROWS) rows.unshift(' '.repeat(w));
  return { w, rows };
}
