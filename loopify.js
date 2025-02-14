(function() {

    function loopify(uri,cb) {

      var context = new (window.AudioContext || window.webkitAudioContext)(),
          request = new XMLHttpRequest();
      
      // If we have not interacted with the page, we can't play audio
      // Try to resume it every 100ms, only once su
      var can_play = false;
      var resume_timeout = 100;

      const timeout = (prom, time) => {
        return Promise.race([prom, new Promise((_r, rej) => setTimeout(rej, time))])
      };

      function resume() {
        timeout(context.resume(), resume_timeout).then(() => {can_play = true}, resume);
      }

      resume();

      request.responseType = "arraybuffer";
      request.open("GET", uri, true);

      // XHR failed
      request.onerror = function() {
        cb(new Error("Couldn't load audio from " + uri));
      };

      // XHR complete
      request.onload = function() {
        context.decodeAudioData(request.response,success,function(err){
          // Audio was bad
          cb(new Error("Couldn't decode audio from " + uri));
        });
      };

      request.send();

      function success(buffer) {

        var source;

        function canPlay() {
          return can_play;
        }

        function play() {

          // NOTE: we don't check for the 'can_play' flag here on purpose!!
          // If the first time we interact with the page is, for example,
          // pressing the play button, this would lead to a race condition
          // and probably gobble up the first press of the button.

          // Stop if it's already playing
          stop();

          // Create a new source (can't replay an existing source)
          source = context.createBufferSource();
          source.connect(context.destination);

          // Set the buffer
          source.buffer = buffer;
          source.loop = true;

          // Play it
          source.start(0);

        }

        function stop() {

          // Stop and clear if it's playing
          if (source) {
            source.stop();
            source = null;
          }

        }

        cb(null,{
          canPlay: canPlay,
          play: play,
          stop: stop
        });

      }

    }

    loopify.version = "0.1";

    if (typeof define === "function" && define.amd) {
      define(function() { return loopify; });
    } else if (typeof module === "object" && module.exports) {
      module.exports = loopify;
    } else {
      this.loopify = loopify;
    }

})();
