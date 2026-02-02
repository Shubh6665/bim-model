web: pnpm railway:start
clock: node -e "fetch('https://bim-model-production.up.railway.app/api/cron/sensor-update',{headers:{authorization:'Bearer '+process.env.CRON_SECRET}}).then(r=>r.text()).then(t=>{console.log(t); if(!t) process.exit(1);}).catch(e=>{console.error(e);process.exit(1);})"
