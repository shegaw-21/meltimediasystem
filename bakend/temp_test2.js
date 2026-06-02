const express = require('express');
const path = require('path');
const app = express();
app.get('/test', (req,res)=>{res.download(path.join(__dirname,'nope.json'), 'nope.json');});
app.listen(3002, ()=>console.log('ready'));
