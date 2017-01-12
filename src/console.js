import Utils from './utils';

function log(e) {
  console.log(e);
}

function logDesync(e) {
  log(`DESYNC : ${JSON.stringify(e)}`);
}

function error(res, err) {
  if (err.code) {
    Utils.reason(res, err.code, err.text);
  } else {
    log(err);
    Utils.reason(res, 500, 'Unknown error');
  }
}

function trace(req, res, next) {
  log(`${req.method} ${req.url}`);
  log(`    ${req.body.json}`);
  function afterResponse() {
    res.removeListener('finish', afterResponse);
    log(`${res.statusCode} ${res.statusMessage}\n`);
  }
  res.on('finish', afterResponse);
  next();
}

const Console = {
  log,
  logDesync,
  error,
  trace,
};

export default Console;
