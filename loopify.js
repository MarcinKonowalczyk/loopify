(function() {

    function loopify(uri,cb) {

      var context = new (window.AudioContext || window.webkitAudioContext)();
      var request = new XMLHttpRequest();

      var obj = undefined;
      
      // If we have not interacted with the page, we can't play audio
      // Try to resume it every 100ms, only once successful we can play
      var can_play = false;
      var want_to_play = false; // if we want to play but can't yet
      var resume_timeout = 100; // milliseconds

      const timeout = (prom, time) => {
        return Promise.race([prom, new Promise((_r, rej) => setTimeout(rej, time))])
      };

      function resume() {
        timeout(context.resume(), resume_timeout).then(() => {
            // Context is resumed! We can play audio now.
            can_play = true;

            // I we want to play, do it now
            if (want_to_play) {
              want_to_play = false;
              if (obj !== undefined) obj.play();
            }
        }, resume);
      }

      if (context.state === "running") {
        // no need to resume, we can play already
        can_play = true;
      } else {
        resume();
      }

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
        var future_id ; // id of the timeout for the next play

        function play(fade_time) {
        
          if (fade_time === undefined) {
            fade_time = 0.0;
          }

          // We cannot play yet, but maybe this was triggered by our first
          // interaction with the page, and we will be able to play soon.
          // There is a race between call to play and the callback of the
          // resume of the context. We just set a flag here, and return.
          // The resume callback will check this flag and play if needed.
          if (!can_play) {
            // We can't play audio yet
            want_to_play = true;
            return;
          }

          // Stop if it's already playing
          stop();

          // Called at the start of the new segment, 'fade_time' before
          // the end of the previous one
          function playSegment(prev_gain) {
            var now = context.currentTime;

            // Create a new source (can't replay an existing source)
            source = context.createBufferSource();
            var gain = context.createGain();
            source.connect(gain).connect(context.destination);
            source.buffer = buffer;

            // Fade in this segment
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(1, now + fade_time);

            // Crossfade with previous segment if it exists
            if (prev_gain !== undefined) {
              prev_gain.gain.linearRampToValueAtTime(0, now + fade_time);
            }

            // start source
            source.start(now);

            return gain;
          }
        
          // Play segment and recursively schedule the next one
          function recursivePlay(prev_gain) {
            // Play the current segment
            var gain = playSegment(prev_gain);
            
            // Schedule ourselves to play the next segment
            future_id = setTimeout(() => {
              recursivePlay(gain);
            }, (buffer.duration - fade_time) * 1000);
          }

          recursivePlay();

        }

        function stop() {

          want_to_play = false;

          // Stop and clear if it's playing
          if (source) {
            source.stop();
            source = null;
          }

          // Clear any future play timeouts
          if (future_id) {
            clearTimeout(future_id);
            future_id = null;
          }

        }

        function playing() {
          return source !== undefined;
        }

        // Return the object to the callback
        obj = {
          play: play,
          stop: stop,
          playing: playing,
        }

        cb(null, obj);

      }

    }

    loopify.version = "0.2";

    if (typeof define === "function" && define.amd) {
      define(function() { return loopify; });
    } else if (typeof module === "object" && module.exports) {
      module.exports = loopify;
    } else {
      this.loopify = loopify;
    }

})();
