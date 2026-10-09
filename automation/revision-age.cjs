// Wikipedia revision timestamps are UTC instants, never local wall-clock times.
function revisionAge(timestamp, minimumMinutes, now=Date.now()) {
 if(typeof timestamp!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(timestamp))throw Error('Source revision timestamp is missing or invalid; existing data preserved.');
 const instant=Date.parse(timestamp);
 if(!Number.isFinite(instant)||new Date(instant).toISOString()!==timestamp.replace(/Z$/,timestamp.includes('.')?'Z':'.000Z'))throw Error('Source revision timestamp is invalid; existing data preserved.');
 if(!Number.isFinite(now)||!Number.isFinite(minimumMinutes)||minimumMinutes<=0)throw Error('Invalid verification clock or minimum revision age.');
 if(instant>now)throw Error('Source revision timestamp is in the future; check clock/source metadata. Existing data preserved.');
 const ageSeconds=(now-instant)/1000,minimumAgeSeconds=minimumMinutes*60;
 return {revisionTimestamp:timestamp,checkedAt:new Date(now).toISOString(),ageSeconds,minimumAgeSeconds,retryAfter:new Date(instant+minimumAgeSeconds*1000).toISOString(),deferred:ageSeconds<minimumAgeSeconds};
}
module.exports={revisionAge};
