const url = require('url');
const https = require('https');
const http = require('http');
const querystring = require('querystring');
const zlib = require('zlib');

interface IConfig {
    ApiConfig: {key: string, value: string};
    Logger: ILogger
}

interface ILogger {
    error: (message: string) => void;
    info: (message: string) => void;
}

module.exports = function httpProxy(req, res, config: IConfig) {
    const {ApiConfig, Logger} = config;
    const key = req.params.key;
    const urlObj = url.parse(ApiConfig[key] || '');
    const origin = url.parse(req.url);
    const originQuery = origin.query;
    const body = req.body;
    let postData = '';
    const hasQuery = !!urlObj.query;

    if (!(key in ApiConfig)) {
        return res.json({
            status: 1000,
            message: '请求的接口不存在',
        });
    }

    // 处理query参数，将请求的参数追加到最终代理接口上
    if (originQuery) {
        urlObj.path += (hasQuery ? '&' : '?') + originQuery;
        urlObj.query = hasQuery ? urlObj.query + '&' + originQuery : originQuery;
        urlObj.href += (hasQuery ? '&' : '?') + originQuery;
    }

    urlObj.headers = req.headers;
    urlObj.method = req.method;

    urlObj.headers.host = urlObj.host;

    // 处理POST数据的body
    if (req.method === 'POST') {
        if (req.headers['content-type'] === 'application/json') {
            postData = JSON.stringify(body);
        } else {
            postData = querystring.stringify(body);
        }
    }

    // 纠正content-length,如果是 **body带有汉字的** ，取length不是取的字节，导致传给服务器的body解析出错
    if (postData && 'content-length' in urlObj.headers) {
        urlObj.headers['content-length'] = Buffer.byteLength(postData);
    }
    let client = urlObj.protocol === 'https:' ? https : http; // 获取请求协议
    let proxy = client.request(urlObj, function (response) {
        res.status(response.statusCode);
        res.set(response.headers);
        response.pipe(res); // response => res

        const contentType = response.headers['content-type'];
        const encoding = response.headers['content-encoding']; // 获取服务器的压缩方式
        const canUnZip = encoding === 'gzip' || encoding === 'deflate';
        const isTextFile = /(text|xml|html|plain|json|javascript|css)/.test(contentType);
        let _data = '';

        // 开启了服务器压缩模式，需要进行压缩数据的pipe传输，保证日志_data输出不乱码
        if (canUnZip && isTextFile) {
            let unzipStream;
            try {
                unzipStream = encoding === 'gzip' ? zlib.createUnzip() : zlib.createInflate();
            } catch (e) {
                Logger.error(`zlib出错：${JSON.stringify(e.stack)}`);
            }
            unzipStream.on('data', (chunk) => {
                _data += chunk;
            });
            response.pipe(unzipStream).on('end', logAPI);
        } else {
            // 未开启服务器压缩模式，只需要直接拼接数据即可
            response.on('data', (data) => {
                _data += data.toString();
            });
            // 响应结束之后，在日志中收集_data
            response.on('end', logAPI);
        }

        function logAPI() {
            Logger.info('接口代理请求完成，请求信息:' + urlObj.href + '状态:' + response.statusCode + '请求参数: ' + JSON.stringify(postData) + '响应的数据：' + JSON.stringify(_data));
        }
    });

    if (req.method === 'POST') {
        if (/multipart\/form-data/i.test(req.headers['content-type'])) {
            req.pipe(proxy);
        } else {
            proxy.write(postData);
            proxy.end();
        }
    } else {
        proxy.end();
    }
    res.on('close', function () {
        proxy.abort();
    });

    proxy.on('error', function (err) {
        Logger.error('接口代理请求失败，请求信息:' + urlObj.href + '请求参数: ' + postData + '错误信息：' + err);
        res.json({
            status: 1001,
            message: '网络繁忙，请稍后再试',
        });
    });
};