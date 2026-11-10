// Four in a Row: the opening book (written by tests/sim/c4-table.js; do not edit by hand). key=column: the mover's
// pieces and the other side's as masks (ai.js c4Key), and the column Hard's own search chooses with 2000000 positions.
// 323 positions: every one Hard can meet in its first 6 plies when it follows the table.
export const C4_BOOK = `
0.0=3 0.1r4zlr7k=3 0.3i9z7if4=3 0.fs8wfsw=3 0.vkhsvls=2 1r4zlr7k.1bcqpbeo=2 1r4zlr7k.4duh0e0w=3 1r4zlr7k.7w4g7wg0=4
1r4zlr7k.ewoemxa8=1 1r4zlr7k.sxsbgyyo=5 1r4zlr7k.vtdfvuo=1 1r4zlr7k.w292w3k=2 1r523nk0.1blmcbnk=1 1r523nk0.4e3cne9s=3 1r523nk0.7wdbuwow=2 1r523nk0.ewxa9xj4=1
1r523nk0.sy173z7k=3 1r523nk0.vtdgl4w=2 1r523nk0.wb4pwcg=1 1r54ljwg.1buhzbwg=2 1r54ljwg.4ec8aeio=2 1r54ljwg.7wm7hwxs=2 1r54ljwg.ex65wxs0=2 1r54ljwg.sya2qzgg=5
1r54ljwg.w294ao0=5 1r54ljwg.wb4pwcg=2 1rdv8rgg.16yw8b0n4=5 1rdv8rgg.ewoh4tmo=6 1rdv8rgg.ex65wxs0=2 1rdv8rgg.f0mgv18g=6 1rdv8rgg.fcgnjd34=2 1rdv8rgg.ieydufpc=3
1rdv8rgg.lx8d1y4g=6 1rmqvrpc.1bcvp43k=2 1rmqvrpc.1bh6itj4=2 1rmqvrpc.1blmcbnk=2 1rmqvrpc.4tmpwtts=3 1rmqvrpc.8bwp4c8w=2 1rmqvrpc.fcgnjd34=2 1rmqvrpc.tdkkderk=2
1s4i5s74.12l1ramm8=5 1s4i5s74.4duqzzeo=3 1s4i5s74.4e3cne9s=3 1s4i5s74.4ec8aeio=3 1s4i5s74.4tmpwtts=2 1s4i5s74.aiu7m4n4=3 1s4i5s74.ajbowjr4=3 1s4i5s74.aksyql8g=4
1s4i5s74.aym6iz28=2 1s4i5s74.beeffev4=2 1s4i5s74.ieydufpc=4 1s4i5s74.ojxugkxs=6 1s4i5s74.wg2aohds=2 1t40pt6o.7w50737k=4 1t40pt6o.7wdbuwow=4 1t40pt6o.7wm7hwxs=2
1t40pt6o.8bwp4c8w=4 1t40pt6o.beeffev4=4 1t40pt6o.lx8d1y4g=4 1t40pt6o.zyc9vzsw=4 3i9z7if4.1bcqpbeo=3 3i9z7if4.1r4zlr7k=2 3i9z7if4.1rmqvrpc=2 3i9z7if4.1s4i5s74=3
3i9z7if4.26x8i70g=3 3i9z7if4.2mphemtc=3 3i9z7if4.7gc7bgn4=3 3i9z7if4.7w4g7wg0=3 3i9z7if4.8roy0s1s=3 3i9z7if4.egw5qhhc=3 3i9z7if4.fs8wfsw=4 3i9z7if4.fwopxxc=4
3i9z7if4.grrggsg=3 3i9z7if4.si02kj5s=3 3i9z7if4.vkhsvls=3 3i9z7if4.zik0zk=3 3ia47b40.1rmqx69s=3 3ia47b40.1sm9fsow=2 3ia47b40.27ezs7i8=2 3ia47b40.2n78onb4=2
3ia47b40.8s6pasjk=2 3ia47b40.fsqnptds=3 3ia47b40.ttukjv28=3 3ia973sw.1cc99ce8=5 3ia973sw.1s4i5s74=3 3ia973sw.1s4i8lc0=3 3ia973sw.1sm9fsow=3 3ia973sw.27wr2800=2
3ia973sw.2nozynsw=3 3ia973sw.7hbpvhmo=3 3ia973sw.7x3yrxfk=3 3ia973sw.8sogkt1c=3 3ia973sw.ehvoaigw=3 3ia973sw.grrggsg=4 3ia973sw.grrj9xc=5 3ia973sw.gw79yww=5
3ia973sw.sizl4k5c=2 3ia973sw.wk0cwlc=3 3ia973sw.zimu4g=5 3ia99wxs.1cc99ce8=3 3ia99wxs.1s4i5szk=6 3ia99wxs.1sm9fsow=3 3ia99wxs.27wr2800=2 3ia99wxs.2nozynsw=2
3ia99wxs.7hbpvhmo=4 3ia99wxs.7x3yrxfk=3 3ia99wxs.8sogkt1c=2 3ia99wxs.ehvoaigw=3 3ia99wxs.exnx6y9s=3 3ia99wxs.wk0cxds=1 3ia99wxs.wsvzwu8=3 3irqhiww.1r54ljwg=3
3irqhiww.1s4i5s74=3 3irqhiww.26x8i70g=2 3irqhiww.2mphemtc=2 3irqhiww.8roy0s1s=4 3irqhiww.fs8wfsw0=2 3irqhiww.ttct9ukg=2 3irvhbls.10twroveo=2 3irvhbls.17ugq3w8w=2
3irvhbls.26x8jlkw=1 3irvhbls.271obp4w=2 3irvhbls.27wr2800=2 3irvhbls.2mphg1ds=1 3irvhbls.2myd1n28=2 3irvhbls.2nozynsw=2 3irvhbls.32hqb2m8=3 3irvhbls.97h6x7uo=2
3irvhbls.9n9ftnnk=1 3irvhbls.fs8wh7gg=5 3irvhbls.ft8eztvk=3 3irvhbls.fw6ynwu8=2 3irvhbls.g815c8ow=2 3irvhbls.gnte8ohs=2 3irvhbls.mssuutq8=2 3irvhbls.ttctb94w=3
3irvhbls.tucbtvk0=3 3irvhbls.u18xq2gw=2 3irvhbls.u9526adc=2 3irvhbls.uoxb2q68=2 3is0h4ao.1s4i8lc0=2 3is0h4ao.1s4n5kw0=3 3is0h4ao.27wr2800=3 3is0h4ao.2nozynsw=2
3is0h4ao.8sogkt1c=3 3is0h4ao.ft8eztvk=3 3is0h4ao.tucbtvk0=2 3j9hrjeo.1bcqpbeo=3 3j9hrjeo.1bd0owsg=3 3j9hrjeo.1bh6itj4=3 3j9hrjeo.1blmcbnk=5 3j9hrjeo.26xihse8=3
3j9hrjeo.271obp4w=3 3j9hrjeo.27ezs7i8=3 3j9hrjeo.2mphemtc=3 3j9hrjeo.2mpre874=3 3j9hrjeo.2myd1n28=1 3j9hrjeo.2n78onb4=3 3j9hrjeo.32hqb2m8=2 3j9hrjeo.7gchb20w=3
3j9hrjeo.7ggn4yrk=3 3j9hrjeo.7ib8fim8=3 3j9hrjeo.7w4g7wg0=1 3j9hrjeo.7w4q7hts=3 3j9hrjeo.7wdbuwow=1 3j9hrjeo.7y3hbyf4=4 3j9hrjeo.8bwp4c8w=3 3j9hrjeo.8rp80dfk=3
3j9hrjeo.8s6pasjk=2 3j9hrjeo.97h6x7uo=2 3j9hrjeo.9n9ftnnk=2 3j9hrjeo.egw5qhhc=3 3j9hrjeo.egwfq2v4=3 3j9hrjeo.eh0ljzls=5 3j9hrjeo.eku7ylfk=5 3j9hrjeo.ewoemxa8=3
3j9hrjeo.fcgnjd34=5 3j9hrjeo.g815c8ow=3 3j9hrjeo.gnte8ohs=2 3j9hrjeo.lhg45ibk=4 3j9hrjeo.si0ck4jk=3 3j9hrjeo.si4ie1a8=4 3j9hrjeo.tdkkderk=3 3j9hrjeo.u9526adc=2
3j9hrjeo.vkrsgzk=3 3j9hrjeo.vtdfvuo=3 3j9hucjk.1bd0owsg=4 3j9hucjk.2mpre874=2 3j9hucjk.7w4q7hts=1 3j9hucjk.egwfq2v4=5 3j9hucjk.ewoomio0=1 3j9hucjk.vkrshs0=1
3j9hucjk.vtnfh8g=5 3j9rr4sg.1bcqs4jk=1 3j9rr4sg.1bh6itj4=3 3j9rr4sg.1blmcbnk=3 3j9rr4sg.2mphhfy8=3 3j9rr4sg.2myd1n28=3 3j9rr4sg.2n78onb4=3 3j9rr4sg.32hqb2m8=3
3j9rr4sg.7wdbuwow=3 3j9rr4sg.8bwp4c8w=3 3j9rr4sg.9n9ftnnk=3 3j9rr4sg.egw5tam8=0 3j9rr4sg.eh0ljzls=3 3j9rr4sg.eku7ylfk=3 3j9rr4sg.ewoepqf4=1 3j9rr4sg.ewxa9xj4=3
3j9rr4sg.fcgnjd34=3 3j9rr4sg.g815c8ow=3 3j9rr4sg.gnte8ohs=3 3j9rr4sg.lhg45ibk=3 3j9rr4sg.tdkkderk=3 3j9rr4sg.vtdiozk=1 3j9rr4sg.vtfxs74=3 3jidejnk.7w4ipssg=4
3jidejnk.7w4q7hts=3 3jidejnk.7y3hbyf4=3 3jidejnk.8bwp4c8w=3 3jidejnk.9n9ftnnk=3 3jidejnk.lx8d1y4g=0 3jidejnk.zyc9vzsw=3 3jr91jwg.1r54mygw=6 3jr91jwg.1r5el5a8=3
3jr91jwg.26xdhzpc=6 3jr91jwg.2mpmefi8=1 3jr91jwg.8rp30kqo=3 3jr91jwg.fs91flkw=5 3jr91jwg.ttcy9n9c=2 3kqrlkw0.8rp30kqo=2 3kqrlkw0.8sogkt1c=3 3kqrlkw0.97h6x7uo=2
3kqrlkw0.9n9ftnnk=3 4duqzzeo.18e9udc=2 4duqzzeo.1s4i8lc0=3 4duqzzeo.71jh1uyo=4 4duqzzeo.e23fgvsw=2 4duqzzeo.grrj9xc=4 4duqzzeo.s37caxhc=2 4duqzzeo.zimuww=2
59eyt9mo.163bqi51c=1 59eyt9mo.16b7uycxs=1 59eyt9mo.s2pky3uo=4 59eyt9mo.s37c84cg=4 59eyt9mo.sa3y4b9c=4 59eyt9mo.sa6612bk=6 59eyt9mo.salpebr4=4 59eyt9mo.sb3goc8w=4
59eyt9mo.si02kj5s=4 59eyt9mo.spw70r28=4 59eyt9mo.sxsbgyyo=3 59eyt9mo.t5ofx6v4=3 59eyt9mo.z2rs3474=2 59eyt9mo.zanwjc3k=2 59f8sv0g.164b9260w=1 59f8sv0g.s37caxhc=4
59f8sv0g.s3p3i4u8=4 59f8sv0g.sb3goc8w=4 59f8sv0g.sizl4k5c=4 59f8sv0g.syru0zy8=3 59f8sv0g.z3ran56o=3 59wq3a4g.1d3vox5vk=3 59wq3a4g.z2rx2ww0=3 59wq3a4g.z3ran56o=2
59wq3a4g.z4qt7668=2 59wq3a4g.zanwjc3k=3 59wq3a4g.zik0zk00=3 59wq3a4g.zyc9vzsw=3 5aehdam8.16yw8b0n4=3 5aehdam8.sxslgkcg=2 5aehdam8.sy173z7k=3 5aehdam8.sya2qzgg=3
5aehdam8.t5ofx6v4=4 5aehdam8.tdkkderk=2 5aehdam8.zyc9vzsw=2 64zgm58g.163km55a8=4 64zgm58g.163ths5j4=4 64zgm58g.164b9260w=4 64zgm58g.1679sq8zk=4 64zgm58g.16b7uycxs=4
64zgm58g.16j3zeku8=4 64zgm58g.1d3vox5vk=0 7w4g7wg0.16j3zeku8=4 7w4g7wg0.eh0ljzls=4 7w4g7wg0.eh51dhq8=5 7w4g7wg0.eiv6ujgg=4 7w4g7wg0.eku7ylfk=1 7w4g7wg0.g815c8ow=4
7w4g7wg0.hz64xzwg=3 c9yx8agw.1bh6itj4=5 c9yx8agw.1cc99ce8=5 c9yx8agw.1dbrtdds=5 c9yx8agw.eh0ljzls=1 c9yx8agw.ehvoaigw=1 c9yx8agw.eiv6ujgg=1 c9yx8agw.fwpyw3k=1
c9yx8agw.gefzyf4=1 c9yx8agw.gs1g268=1 c9yx8agw.gw79yww=1 c9yx8agw.h9iqha8=1 c9yx8agw.hrtzojk=1 c9yx8agw.hvptzwg=1 c9yx8agw.i91ai9s=1 c9yx8agw.iqskirk=1
c9yx8agw.si4ie1a8=1 c9yx8agw.sihtujnk=5 c9yx8agw.sizl4k5c=1 c9yx8agw.tdkkderk=5 zik0zk.3ia973sw=3 zik0zk.3y283y80=3 zik0zk.4duh0e0w=2 zik0zk.59eyt9mo=4
zimu4g.3ia974lc=2 zimu4g.3y2i3jls=4 zimu4g.4duqzzeo=2 zimu4g.59f8sv0g=1 zsjmdc.3y286rcw=2 zsjmdc.3y6nxgcg=3 zsjmdc.4tmpwtts=2 zsjmdc.5p77ppfk=1
zsjmdc.aym6iz28=3 zsjmdc.hz64xzwg=3 zsjmdc.w0a1s1kw=3
`.replace(/\s+/g, ' ').trim();
