// Hex: the book (written by tests/sim/hex-table.js; do not edit by hand). The solved 5x5 game: the winner's move in
// every position the search at the board would not finish (ai.js HEX_SOLVE.cap), along every line the other side can
// choose. key=entry: the position as the mover sees it (ai.js hexKey); w or l (the mover wins or loses the square),
// then the cell, or s for the swap (a lone stone: the swap, then the stone to play when it may not be taken).
// 190 positions.
export const HEX_BOOK = `
0=w3 1=w12 13ydkpc=w8 13yot8g=w7 166ab2o=w13 166ab34=w1 1k4oizdb4=w3 1k4oize2o=w2 1k4ojalts=w14 1k4sz43z4=w12 1kw=ws,l16 1r4zlrlt=w4
1r4zlrmo=w4 1r4zm3up=w9 1r4zm3vk=w23 1r4zokdc=w7 1r4zrdi8=w7 1r4zwzs0=w1 1r63vdb5=w7 1r63vdcw=w17 1r63vdeo=w17 1r63vdpc=w4 1r63ve2p=w5 1r63ve2s=w13
1r63ve3k=w0 1r63ve68=w17 1r63vegw=w14 1r63vqps=w9 1r63w2lc=w20 1r63w3cw=w20 1r6nukyo=w17 1rdv8s1t=w3 1rdv8s2o=w18 1rdv94io=w3 1rdvbl0g=w7 1rdvee5c=w7
1rdvk0f4=w3 1rezie1s=w17 1rib2a9t=w18 1rib2mqo=w17 1ribdin4=w17 1rnv5eo1=w17 1s=ws,l11 1s4i64xs=w9 1s4ih0u8=w2 1s6qdrxc=w3 1s6qdsow=w3 1s6qeh6o=w3
1sb67a28=w13 1sb67ats=w13 1sb67zbk=w13 1z142rk=w15 2=w16 23gxk44=w13 23gxkw4=w6 23gyzgg=w11 23gzny8=w11 32zhlwk=w1 32zsv80=w13 343fzg4=w13
35s=ws,l7 3k=ws,l17 3mch9hjk=w23 3mchetxs=w22 3mchkg7k=w23 3y28a9s=w17 3y28gow=w16 3y28hds=w15 3y28mww=w17 3y295vk=w11 3y2e2v4=w22 3y2jchs=w14
3y2jp4w=w23 3y4qcxs=w18 3y77xfk=w15 3y782yo=w18 3y789a8=w18 3y78lxc=w11 3yc81z4=w19 4=w12 42i1m40=w9 42i1mhc=w13 42i1mvk=w9 42i1p8w=w13
42i1se9=w4 42i2bdc=w11 4fti4h=w10 4fti4k=w7 4fti4w=w8 4fti5c=w10 4fti68=w11 4fti80=w2 4ftibk=w4 4ftiww=w2 4ftjpc=w6 4ftla8=w21
4ftog0=w8 4fturk=w4 4fu7eo=w11 4fuwow=w7 4gfz7k=w7 6nq9a9=w5 6nq9b4=w1 6nq9z6=w6 6nq9zk=w13 6nqa00=w1 6nqa2o=w6 6nqbk0=w1
6nqfls=w8 6nrojk=w1 74=ws,l13 7romu9=w6 7ronj5=w16 7ronjk=w13 7rq234=w13 8=w12 8vn08x=w10 8vn09s=w10 8vn0g0=w3 8vn11c=w2
8vn6kg=w17 b3js4g=w1 b3jshs=w6 b3jyf4=w17 b3k4qo=w6 b3khds=w1 ciqnalkdc=w17 ciqnalkf4=w17 ciqnall6o=w17 ciqnamyw0=w17 dbgilc=w1 dbgv0h=w5
dbgv1c=w1 e8=l7 eff8kh=w20 fwopy0x=w12 fwopy1s=w12 fwopy4h=w13 fwopy5c=w13 fwopzi9=w6 fwopzj4=w6 fwoq135=w21 fwoq140=w21 fwoqakh=w9
fwoqalc=w9 g=ws,l13 g14jg8x=w13 g14jg9s=w13 grrgh0g=w13 grrgtgg=w9 oxz2t8kr4=w8 oxz2t8krk=w10 oxz2t8l4w=w13 oxz2t8lj4=w7 oy11ucnio=w8 oy11ucp34=w16
oy30vgoq8=w13 oy30vgphs=w7 s28xmhpg=w6 s28xmhr4=w2 s28xmi3k=w8 s28xmja8=w0 s28xmucg=w8 s28xpau8=w8 s28xxq8w=w0 s2a1kv9d=w1 s2a1kva8=w1 s2a1kvnk=w12
s2a1l7wg=w12 s2a1w3sw=w1 s2pky4ox=w2 s2pkyha9=w4 s37c855w=w1 s37c85j8=w13 sg=w16 vkhsvnk=w2 vkiwud5s=w23 vmppmpt=w1 vmppmqo=w1 voxn3sw=w20
voxohkw=w7 w=w12 zik0zl=w10 zik0zm=w10 zik10g=w10 zik134=w12 zik16o=w13 zik1s0=w5 zikda0w=w23 zikdmo=w9
`.replace(/\s+/g, ' ').trim();
