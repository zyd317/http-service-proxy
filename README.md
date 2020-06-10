# http-service-proxy
http-service-proxy

### usage
0. 
`npm install http-service-proxy --save`

1. 
```
    const proxySub = require('http-service-proxy');
    const API_PROXY = require('./API_PROXY');
    express.Router()
        .use('/http/:key', (req, res) => proxySub(req, res, {
            ApiConfig,
            Logger: req.logger
        }));
```
