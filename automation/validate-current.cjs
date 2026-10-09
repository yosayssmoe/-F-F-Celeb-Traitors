const {load,D,T,E,stable}=require('./shared.cjs'),{assertDraw}=require('./merge.cjs');
const data=load();D.validate(data);assertDraw(data);const score=T.compute(data),totals=E.totals(data);
const ava=score.contestants['Joanne McNally'].celebScore+2*score.contestants['Miranda Hart'].celebScore;
if(totals.Ava!==ava)throw Error('Ava multiplier invariant failed.');
if(Object.values(score.contestants).some(s=>!Number.isFinite(s.celebScore)))throw Error('Invalid score.');
console.log('Dataset validated: '+stable(totals));
