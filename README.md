# http-service-proxy
http-service-proxy

## Table of Contents

<!-- MarkdownTOC autolink=true bracket=round depth=2 -->

- [Install](#install)
- [Example](#example)

<!-- /MarkdownTOC -->

## Install

```bash
$ npm install --save /http-service-proxy
```

## Example
```javascript
const express = require('express');
const proxy = require('http-service-proxy');
const ApiConfig = require('./ApiConfig');
const proxySub = (req, res) => proxy(req, res, {ApiConfig, Logger: req.logger});
express.Router().use('/http/:key', proxySub);
```
