import { exactSubsetExists } from './scripts/procure-to-pay-three-way-match-exception-reconciler.mjs';
const vals = [1034587n, 1047293n, 1061981n, 1085149n, 1093847n, 1111117n, 1123459n, 1135793n, 1157923n, 1170361n, 1182727n, 1195099n, 1207481n, 1219879n, 1232287n, 1244701n, 1257133n, 1269571n, 1282019n, 1294481n, 1306951n, 1319437n, 1331933n, 1344439n, 1356961n, 1369487n, 1382029n, 1394581n, 1407139n, 1419703n, 1432279n, 1444861n, 1457449n, 1470041n, 1482647n, 1495261n, 1507879n, 1520513n, 1533151n, 1545799n];
const total=vals.reduce((a,b)=>a+b,0n); const target=total/2n + 17n;
console.time('subset'); console.log(exactSubsetExists(vals,target)); console.timeEnd('subset');
