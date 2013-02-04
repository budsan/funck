// Code in ~2 hours by Bemmu, idea and sound code snippet from Viznut.
// 2011-09-30 - Modifications by raer.
// 2011-10-07 - Modifications by raer.
// 2013-01-30 - Modifications by bud.

function mixAB(a, b, t)
{
	return (a + b * t) / (1.0 + t);
}

function generateSound(params) {
	//private
	var _rate = params.rate;
	var _t0 = params.t0;
	var _tmod = params.tmod;
	var _seconds = params.duration;
	var _channels = 1;
	var _f1 = null, _f2 = null;
	var _separation = params.separation;
	_separation = 1.0 - _separation / 100.0;
	var _samples = [];
	var _curChan = 0;

	//public
	var sin = Math.sin;
	var cos = Math.cos;
	var tan = Math.tan;
	var floor = Math.floor;
	var ceil  = Math.ceil;
	var PI  = Math.PI;

	var t = 0;
	var rate = 0;
	var s = function(i, chan) {
		if (typeof chan === 'undefined') chan = _curChan;
		i *= _channels;
		if (i >= 0 && i < _samples.length) return _samples[i+chan];
		return 0;
	};
	
	//userspace
	eval (params.aux);
	eval("_f1 = function (t) { return " + params.oneliner + ";}");
	if (params.oneliner2 != "") {
		eval("_f2 = function (t) { return " + params.oneliner2 + ";}");
		_channels = 2;
	}
	
	for (var _t = _t0; _t < _rate*_seconds; _t++) {
		// just in case this vars are modified.
		t = _t; 
		rate = _rate;

		//mod t with user-set value if any
		var cT;
		if (_tmod > 0) {
			cT = t%_tmod;
		}
		else {
			cT = t;
		}

		//left channel
		var sample = _f1(cT);
		var sample2;
		if (_channels > 1 && _f2 != null) {
			//right channel
			_curChan = 1;
			sample2 = _f2(cT);
			_curChan = 0;

			//calculate value with stereo separation and normalize
			var newSample = mixAB(sample, sample2, _separation);
			var newSample2 = mixAB(sample2, sample, _separation);
			sample  = newSample;
			sample2 = newSample2;
		}
		//store left sample
		_samples.push(sample);
		//store right sample if any
		if (_channels > 1 && _f2 != null) {
			_samples.push(sample2);
		}
	}

	for(var i = 0; i < _samples.length; i++) {
		var sample = parseInt(_samples[i]);
		sample = (sample & 0xff) * 256;
		if (sample < 0) sample = 0;
		if (sample > 65535) sample = 65535;
		_samples[i] = sample;
	}

	return [_rate, _samples, _channels];
}

// [255, 0] -> "%FF%00"
function b(values) {
	var out = "";
	for (var i = 0; i < values.length; i++) {
		var hex = values[i].toString(16);
		if (hex.length == 1) hex = "0" + hex;
		out += "%" + hex;
	}
	return out.toUpperCase();
}

// Character to ASCII value, or string to array of ASCII values.
function c(str) {
	if (str.length == 1) {
		return str.charCodeAt(0);
	} else {
		var out = [];
		for (var i = 0; i < str.length; i++) {
			out.push(c(str[i]));
		}
		return out;
	}
}

function split32bitValueToBytes(l) {
	return [l&0xff, (l&0xff00)>>8, (l&0xff0000)>>16, (l&0xff000000)>>24];
}


function FMTSubChunk(channels, bitsPerSample, rate) {
	var byteRate = rate * channels * bitsPerSample/8;
	var blockAlign = channels * bitsPerSample/8;
	return [].concat(
		c("fmt "),
		split32bitValueToBytes(16), // Subchunk1Size for PCM
		[1, 0], // PCM is 1, split to 16 bit
		[channels, 0], 
		split32bitValueToBytes(rate),
		split32bitValueToBytes(byteRate),
		[blockAlign, 0],
		[bitsPerSample, 0]
	);
}

function samplesToData(samples, bitsPerSample) {
	if (bitsPerSample === 8) return samples;
	if (bitsPerSample !== 16) {
		alert("Only 8 or 16 bit supported.");
		return;
	}
	
	var data = [];
	for (var i = 0; i < samples.length; i++) {
		data.push(0xff & samples[i]);
		data.push((0xff00 & samples[i])>>8);
	}
	return data;
}

function dataSubChunk(channels, bitsPerSample, samples) {
	return [].concat(
		c("data"),
		split32bitValueToBytes(samples.length * bitsPerSample/8),
		samplesToData(samples, bitsPerSample)
	);
}

function chunkSize(fmt, data) {
	return split32bitValueToBytes(4 + (8 + fmt.length) + (8 + data.length));
}
	
function RIFFChunk(channels, bitsPerSample, rate, samples) {
	var fmt = FMTSubChunk(channels, bitsPerSample, rate);
	var data = dataSubChunk(channels, bitsPerSample, samples);
	var header = [].concat(c("RIFF"), chunkSize(fmt, data), c("WAVE"));
	return [].concat(header, fmt, data);
}

var fftd = {
	canvas:      null,
	ctx:         null,
	channels:    null,
	rate:        null,
	frameBuffer: null,
	frameBufferLength: null,
	fft:         null
};

var el;
var lastPosition;
var audioContext = null;

function makeURL(params) {
	var bitsPerSample = 16;	
	var generated = generateSound(params);
	var rate = generated[0];
	var samples = generated[1];
	var channels = generated[2];

	fftd.canvas = document.getElementById('fft');
	fftd.ctx = fftd.canvas.getContext('2d');

	if (!fftd.canvas || !fftd.canvas.getContext) {
		alert("No canvas or context. Your browser sucks!");
		fftd.frameBuffer = null;
		fftd.channels    = null;
		fftd.rate        = null;
		fftd.frameBufferLength = null;
		fftd.fft = null;
	}
	else
	{
		fftd.frameBuffer = samples;
		fftd.channels    = channels;
		fftd.rate        = parseInt(rate);
		fftd.frameBufferLength = 2048;

		fftd.fft = new FFT(fftd.frameBufferLength / fftd.channels, fftd.rate);
	}

	return "data:audio/x-wav," + b(RIFFChunk(channels, bitsPerSample, rate, samples));	
}

function onTimeUpdate()
{
	if (!el || !fftd.canvas || !fftd.ctx) return;

	var t = parseInt(el.currentTime * fftd.rate);
	var fb = fftd.frameBuffer.slice(t * fftd.channels, (t + fftd.frameBufferLength) * fftd.channels),
	    signal = new Float32Array(fb.length / fftd.channels),
	    magnitude;

	if (fb.length != fftd.frameBufferLength) return;

	for (var i = 0, fbl = fftd.frameBufferLength; i < fbl; i++ ) {
		signal[i] = 0;
		for (var j = 0; j < fftd.channels; j++) {
			var sample = fb[fftd.channels * i + j];
			if (sample > 32767) sample -= 65536;
			signal[i] += sample/32768.0;
		}
		signal[i] /= fftd.channels;
		//((fb[2*i] + fb[2*i+1]) / (65535.0)) - 1.0;
	}

	fftd.fft.forward(signal);

	// Clear the canvas before drawing spectrum
	fftd.ctx.clearRect(0,0, fftd.canvas.width, fftd.canvas.height);

	for (var i = 0; i < fftd.fft.spectrum.length; i++ ) {
		// multiply spectrum by a zoom value
		magnitude = fftd.fft.spectrum[i] * 1000;

		// Draw rectangle bars for each rate bin
		fftd.ctx.fillRect(i * 4, fftd.canvas.height, 3, -magnitude);
	}
}

function stop() {
	if (el) {
		//stop audio and reset src before removing element, otherwise audio keeps playing
		el.pause();
		el.src = "";
		document.getElementById('player').removeChild(el);
		lastPosition = 0;
	}
	el = null;
}

function playDataURI(uri) {
	stop();
	el = document.createElement("audio");
	el.setAttribute("autoplay", true);
	el.setAttribute("src", uri);
	el.setAttribute("controls", "controls");
	
	var who = navigator.sayswho();
	switch(who[0]) {
		case 'Firefox':
			el.addEventListener('MozAudioAvailable', onTimeUpdate, false);
		break;
		case 'Chrome':
			if (audioContext === null) {
				try {
					audioContext = new webkitAudioContext();
				}
					catch(e) {

				}
			}
				if (audioContext !== null) {
				var meter = audioContext.createJavaScriptNode(2048, 1, 1);
				var source = audioContext.createMediaElementSource(el);
				var gain = audioContext.createGainNode();
				meter.onaudioprocess = onTimeUpdate;
				source.connect(gain);
				gain.connect(meter);
				meter.connect(audioContext.destination);
			}
		break;
		default:
			el.addEventListener('timeupdate', onTimeUpdate, false);
		break;
	}
	document.getElementById('player').appendChild(el);
}

// FFT from dsp.js, see below
var FFT = function(bufferSize, sampleRate) {
	this.bufferSize   = bufferSize;
	this.sampleRate   = sampleRate;
	this.spectrum     = new Float32Array(bufferSize/2);
	this.real         = new Float32Array(bufferSize);
	this.imag         = new Float32Array(bufferSize);
	this.reverseTable = new Uint32Array(bufferSize);
	this.sinTable     = new Float32Array(bufferSize);
	this.cosTable     = new Float32Array(bufferSize);

	var limit = 1,
	    bit = bufferSize >> 1;

	while ( limit < bufferSize ) {
		for ( var i = 0; i < limit; i++ ) {
			this.reverseTable[i + limit] = this.reverseTable[i] + bit;
		}

		limit = limit << 1;
		bit = bit >> 1;
	}

	for ( var i = 0; i < bufferSize; i++ ) {
		this.sinTable[i] = Math.sin(-Math.PI/i);
		this.cosTable[i] = Math.cos(-Math.PI/i);
	}
};

FFT.prototype.forward = function(buffer) {
	var bufferSize   = this.bufferSize,
	    cosTable     = this.cosTable,
	    sinTable     = this.sinTable,
	    reverseTable = this.reverseTable,
	    real         = this.real,
	    imag         = this.imag,
	    spectrum     = this.spectrum;

	if ( bufferSize !== buffer.length ) {
		throw "Supplied buffer is not the same size as defined FFT. FFT Size: " + bufferSize + " Buffer Size: " + buffer.length;
	}

	for ( var i = 0; i < bufferSize; i++ ) {
		real[i] = buffer[reverseTable[i]];
		imag[i] = 0;
	}

	var halfSize = 1,
	    phaseShiftStepReal,	
	    phaseShiftStepImag,
	    currentPhaseShiftReal,
	    currentPhaseShiftImag,
	    off,
	    tr,
	    ti,
	    tmpReal,	
	    i;

	while ( halfSize < bufferSize ) {
		phaseShiftStepReal = cosTable[halfSize];
		phaseShiftStepImag = sinTable[halfSize];
		currentPhaseShiftReal = 1.0;
		currentPhaseShiftImag = 0.0;

		for ( var fftStep = 0; fftStep < halfSize; fftStep++ ) {
			i = fftStep;

			while ( i < bufferSize ) {
				off = i + halfSize;
				tr = (currentPhaseShiftReal * real[off]) - (currentPhaseShiftImag * imag[off]);
				ti = (currentPhaseShiftReal * imag[off]) + (currentPhaseShiftImag * real[off]);

				real[off] = real[i] - tr;
				imag[off] = imag[i] - ti;
				real[i] += tr;
				imag[i] += ti;

				i += halfSize << 1;
			}

			tmpReal = currentPhaseShiftReal;
			currentPhaseShiftReal = (tmpReal * phaseShiftStepReal) - (currentPhaseShiftImag * phaseShiftStepImag);
			currentPhaseShiftImag = (tmpReal * phaseShiftStepImag) + (currentPhaseShiftImag * phaseShiftStepReal);
		}

		halfSize = halfSize << 1;
	}

	i = bufferSize/2;
	while(i--) {
		spectrum[i] = 2 * Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / bufferSize;
	}
};

//BROWSER STUFF

navigator.sayswho = ( function(){
var N= navigator.appName, ua= navigator.userAgent, tem;
var M= ua.match(/(opera|chrome|safari|firefox|msie)\/?\s*(\.?\d+(\.\d+)*)/i);
if(M && (tem= ua.match(/version\/([\.\d]+)/i))!= null) M[2]= tem[1];
M= M? [M[1], M[2]]: [N, navigator.appVersion,'-?'];
return M;
});
