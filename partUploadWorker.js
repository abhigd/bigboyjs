importScripts('md5.js');
importScripts('enc-base64-min.js');
importScripts('lib-typedarrays.js');

var xhr = new XMLHttpRequest(),
  fileReader = new FileReaderSync(),
  chunkUploadedSinceLastEvent=0,
  s3Key, partNumber, uploadId,
  bucket_name, size, blob, file, hash, b64_hash;

self.onmessage = function(e) {
  var data = e.data;

  function post(data) {
    self.postMessage(data);
  }

  function uploadPart(url, headers) {
    var xhr = new XMLHttpRequest();
    var length = size;

    xhr.upload.onprogress = function(e) {
      if (e.lengthComputable) {
        var lastUploadedSize = e.loaded - chunkUploadedSinceLastEvent;
        chunkUploadedSinceLastEvent = e.loaded;
        post({"type": "progress", "data": lastUploadedSize});
      }else {
        post({"type": "debug", "data": "onprogress"});
      }
    };
    xhr.onload = function(e) {
      if (this.status < 299) {
        post({"type": "progress", "data": size});
        post({"type": "complete", "data": e.data});
      } else {
        post({"type": "failure", "data": this.statusText});
      }
    };
    xhr.onerror = function(e) {
      post({"type": "failure", "data": xhr.statusText});
    };

    xhr.open('PUT', url, true);
    xhr.setRequestHeader("Content-Type", headers["Content-Type"]);
    // xhr.setRequestHeader("Content-MD5", headers["Content-MD5"]);
    xhr.setRequestHeader("x-amz-date", headers["X-Amz-Date"]);
    xhr.setRequestHeader("Authorization", headers["Authorization"]);
    xhr.setRequestHeader("x-amz-security-token", headers["x-amz-security-token"]);
    xhr.setRequestHeader("x-amz-user-agent", headers["X-Amz-User-Agent"]);

    xhr.send(blob);
  }

  file = fileReader.readAsArrayBuffer(data.blob);
  hash = CryptoJS.MD5( CryptoJS.lib.WordArray.create(file) );
  b64_hash = hash.toString(CryptoJS.enc.Base64);

  s3Key = data.info[1];
  partNumber = data.info[0];
  uploadId = data.info[2];
  bucket_name = data.info[4];
  size = data.info[3];
  blob = data.blob;

  var url = data.url;
  uploadPart(url, data.headers);

};
