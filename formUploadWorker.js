importScripts('md5.js');
importScripts('enc-base64-min.js');
importScripts('lib-typedarrays.js');

self.onmessage = function(e) {
  var workerData = e.data,
      xhr = new XMLHttpRequest(),
      fileReader = new FileReaderSync(),
      file = workerData.file,
      urlPath = workerData.urlPath;

  var f = fileReader.readAsArrayBuffer(file);
  var hash = CryptoJS.MD5( CryptoJS.lib.WordArray.create(f) );
  var b64_hash = hash.toString(CryptoJS.enc.Base64)

  function post(data) {
    self.postMessage(data)
  }

  function uploadForm(data) {
    var formData = JSON.parse(data),
        boundary = '------FormBoundary' + Math.random().toString(36),
        dummyForm = "", internal_data = [],
        buffer = fileReader.readAsArrayBuffer(file);
    var i=0, len;

    post({"type": "key", "data": formData.key});

    formData.fields.forEach(function(item, idx) {
      dummyForm += "--" + boundary + "\r\n";
      dummyForm += 'content-disposition: form-data; name="' + item.name + '"\r\n';
      dummyForm += '\r\n';
      dummyForm += item.value + "\r\n";
    });

    dummyForm += "--" + boundary + "\r\n";
    dummyForm += 'content-disposition: form-data; '
          + 'name="'         + "file"          + '"; '
          + 'filename="'     + file.name + '"\r\n';
    dummyForm += 'Content-Type: ' + file.type + '\r\n';
    //if (formData.hash) {
      dummyForm += 'Content-MD5: ' + b64_hash + '\r\n';
    //}
    dummyForm += '\r\n';

    for (var len=dummyForm.length,i=0; i<len; i++)
        internal_data.push(dummyForm.charCodeAt(i) & 0xff);

    if (!('byteOffset' in buffer))
        buffer = new Uint8Array(buffer);

    for (var len=buffer.byteLength,i=0; i<len; i++)
        internal_data.push(buffer[i] & 0xff);

    var endMarker = '\r\n'+"--" + boundary + "--";
    for (var len=endMarker.length,i=0; i<len; i++)
        internal_data.push(endMarker.charCodeAt(i) & 0xff);

    var payload = new Uint8Array(internal_data).buffer;

    var formXhr = new XMLHttpRequest();
    formXhr.onload = function(e) {
      if (this.status < 299) {
        post({"type": "complete", "data": this.statusText});
      } else {
        post({"type": "failure", "data": this.statusText});
      }
    };
    formXhr.upload.onprogress = function(e) {
      if (e.lengthComputable) {
        var percentLoaded = Math.round((e.loaded / e.total) * 100);
        post({"type": "progress", "data": percentLoaded});
      }
    };
    formXhr.onerror = function(e) {
      post({"type": "failure", "data": formXhr.statusText});
    };
    formXhr.open("POST", formData.action);
    formXhr.setRequestHeader("Content-Type", "multipart/form-data; boundary="+boundary);

    formXhr.send(payload);
  }


  var url = urlPath + "?phase=form"
  var payload = {
    'name': workerData.file.name,
    'size': workerData.file.size,
    'hash': b64_hash
  }
  if (workerData.key) {
    payload['key'] = workerData.key;
  }

  xhr.open('POST', url);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.setRequestHeader("Accept", "application/json");
  xhr.onload = function(e) {
      if (this.status < 299) {
        uploadForm(xhr.response);
      } else {
        post({"type": "failure", "data": this.statusText});
      }
  };
  xhr.onerror = function(e) {
    post({"type": "failure", "data": xhr.statusText});
  };
  xhr.send(JSON.stringify(payload));
};
