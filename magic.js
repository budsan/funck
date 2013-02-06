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
	var _depth = params.depth;
	var _seconds = params.duration;
	var _channels = 1;
	var _f1 = null, _f2 = null;
	var _samples = [];
	var _curChan = 0;
	
	var _post = null;

	//public
	var sin = Math.sin;
	var cos = Math.cos;
	var tan = Math.tan;
	var floor = Math.floor;
	var ceil  = Math.ceil;
	var PI  = Math.PI;

	var t = 0;
	var rate = _rate;
	var s = function(i, chan) {
		if (i >= 0 && i < _samples.length) return _samples[i];
		return 0;
	};
	
	//userspace
	eval (params.aux);
	eval("_f1 = function () { return " + params.oneliner + ";}");
	if (params.oneliner2 != "") {
		eval("_f2 = function () { return " + params.oneliner2 + ";}");
		_channels = 2;
		s = function(i, chan) {
			if (typeof chan === 'undefined') chan = _curChan;
			i *= _channels;
			if (i >= 0 && i < _samples.length) return _samples[i+chan];
			return 0;
		};
	}
	
	for (var _t = 0; _t < _rate*_seconds; _t++) {
		// just in case this vars are modified.
		t = _t; 
		rate = _rate;

		//left channel
		var _sample = _f1();
		var _sample2;
		if (_channels > 1 && _f2 != null) {
			//right channel
			_curChan = 1;
			_sample2 = _f2();
			_curChan = 0;

			//calculate value with stereo separation and normalize
			var _newSample = mixAB(_sample, _sample2, 1.0);
			var _newSample2 = mixAB(_sample2, _sample, 1.0);
			_sample  = _newSample;
			_sample2 = _newSample2;
		}
		//store left sample
		_samples.push(_sample);
		//store right sample if any
		if (_channels > 1 && _f2 != null) {
			_samples.push(_sample2);
		}
	}

	switch(_depth) {
		case 'fnorm':
			_min =  1.7976931348623157E+10308, // Infinity
			_max = -1.7976931348623157E+10308; //-Infinity
			for(var i = 0; i < _samples.length; i++) {
				var _sample = _samples[i];
				if (_sample < _min) _min = _sample;
				if (_sample > _max) _max = _sample;
			}
			
			_d = 1.0 / ((_max - _min) * 0.5);
			for(var i = 0; i < _samples.length; i++) {
				var _sample = _samples[i];
				_samples[i] = ((_sample-_min)*_d) - 1.0;
			}
		case 'fclamp':
			for(var i = 0; i < _samples.length; i++) {
				var _sample = _samples[i];
				if (_sample < -1.0) _sample = -1.0;
				if (_sample >  1.0) _sample =  1.0;
				_sample = parseInt(_sample * 32767);
				if (_sample < 0) _sample += 65536
				_samples[i] = _sample;
			}
		break;
		case '16bits':
			for(var i = 0; i < _samples.length; i++) {
				var _sample = parseInt(_samples[i]);
				_sample = (_sample & 0xffff);
				if (_sample < 0) _sample = 0;
				if (_sample > 65535) _sample = 65535;
				_samples[i] = _sample;
			}
		break;
		case '8bits':
		default:
			for(var i = 0; i < _samples.length; i++) {
				var _sample = parseInt(_samples[i]);
				_sample = (_sample & 0xff) * 256;
				if (_sample < 0) _sample = 0;
				if (_sample > 65535) _sample = 65535;
				_samples[i] = _sample;
			}
		break;
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
var bar;
var audioContext = null;

function makeURL(params, freturn) {
	if (typeof freturn === 'undefined') return;

	var gen = document.getElementById("gen");
	gen.className += " disabled";
	showProgress();
	setTimeout( function () {
		try {
			makeURL_async(params, freturn);
			gen.className = gen.className.replace(" disabled", "");
			document.getElementById('error').innerHTML = "";
		} catch (err) {
			gen.className = gen.className.replace(" disabled", "");
			document.getElementById('error').innerHTML = ""+err;
			alert(err);					
			throw err;
		}
	}, 500);
}

function makeURL_async(params, freturn) {
	var generated = generateSound(params);
	var bitsPerSample = 16;
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
		fftd.frameBufferLength = 2048*4;

		fftd.fft = new FFT(fftd.frameBufferLength, fftd.rate);
	}

	freturn("data:audio/x-wav," + b(RIFFChunk(channels, bitsPerSample, rate, samples)));
}

var xscale = 150;
var yscale = 1000;
var xoffs = -600;

function getMagnitude(v, freq)
{
	return v*yscale;
}

function onTimeUpdate()
{
	if (!el || !fftd.canvas || !fftd.ctx) return;

	var t = parseInt(el.currentTime * fftd.rate);
	var fb = fftd.frameBuffer.slice(t * fftd.channels, (t + fftd.frameBufferLength) * fftd.channels),
	    signal = new Float32Array(fb.length / fftd.channels),
	    magnitude;

	if (fb.length != fftd.frameBufferLength * fftd.channels) return;

	for (var i = 0, fbl = fftd.frameBufferLength; i < fbl; i++ ) {
		signal[i] = 0;
		for (var j = 0; j < fftd.channels; j++) {
			var sample = fb[fftd.channels * i + j];
			if (sample > 32767) sample -= 65536;
			signal[i] += sample/32768.0;
		}
		signal[i] /= fftd.channels;
	}

	fftd.fft.forward(signal);

	var lines = false;
	
	if(lines)
	{
		var baseFreq = fftd.rate / fftd.frameBufferLength;
		var freq = 0;
		var magnitude = 0;
		// Clear the canvas before drawing spectrum
		fftd.ctx.clearRect(0,0, fftd.canvas.width, fftd.canvas.height);
		fftd.ctx.beginPath();
		fftd.ctx.moveTo(0, 0);
		for (var i = 0; i < fftd.fft.spectrum.length; i++ ) {
			freq = baseFreq * i;
			magnitude = getMagnitude(fftd.fft.spectrum[i], freq);
			fftd.ctx.lineTo(Math.log(freq)*xscale+xoffs, fftd.canvas.height - magnitude);
		}
		fftd.ctx.stroke();
	}
	else if(false) //version no optimizada
	{
		var baseFreq = fftd.rate / fftd.frameBufferLength;
		var freq = 0;
		var magnitude = 0;
		var oldx = 0;
		// Clear the canvas before drawing spectrum
		fftd.ctx.clearRect(0,0, fftd.canvas.width, fftd.canvas.height);
		for (var i = 0; i < fftd.fft.spectrum.length; i++ ) {
			freq = baseFreq * (i+0.5);
			magnitude = getMagnitude(fftd.fft.spectrum[i], freq);
			var x = parseInt(Math.log(freq)*xscale)+xoffs;
			var width = x - oldx;
			if(width < 1) width = 1;
			fftd.ctx.fillRect(oldx, fftd.canvas.height, width, -magnitude);
			oldx = x;
		}
	}
	else
	{
		//BUARGH!
		
		var baseFreq = fftd.rate / fftd.frameBufferLength;
		var freq = 0;
		var magnitude = 0;
		var oldx = 0;
		var oldmagnitude = 0;
		// Clear the canvas before drawing spectrum
		fftd.ctx.clearRect(0,0, fftd.canvas.width, fftd.canvas.height);

		for (var i = 0; i < fftd.fft.spectrum.length; i++ ) {
			// multiply spectrum by a zoom value
			freq = baseFreq * (i+0.5);
			magnitude = getMagnitude(fftd.fft.spectrum[i], freq);
			var x = parseInt(Math.log(freq)*xscale)+xoffs;
			if(x == oldx) {
				if(oldmagnitude < magnitude) 
					oldmagnitude = magnitude;
			}
			else {
				if(oldmagnitude > magnitude)
					magnitude = oldmagnitude;
				oldmagnitude = 0;
				var width = x - oldx;
				if(width < 1) width = 1;
				fftd.ctx.fillRect(oldx, fftd.canvas.height, width, -magnitude);
			}
			oldx = x;
		}
	}
}

function stop() {
	if (el) {
		//stop audio and reset src before removing element, otherwise audio keeps playing
		el.pause();
		el.src = "";
		document.getElementById('player').removeChild(el);
	}
	el = null;
}

function showProgress() {
	stop();
	bar = document.createElement("meter");
	bar.setAttribute("value", 0.2);
	document.getElementById('player').appendChild(bar);
}

function playDataURI(uri) {
	stop();
	if (bar) {
		document.getElementById('player').removeChild(bar);
	}
	bar = null;
	
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
				break;
			}
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

function showFrequency(e)
{
	x=e.clientX - document.getElementById("fft").offsetLeft;
	x -= xoffs;
	x /= xscale;
	x = Math.exp(x);
	document.getElementById("fftfreq").innerHTML="Freq: "+x.toFixed(2)+" Hz";
}

function clearFrequency()
{
	document.getElementById("fftfreq").innerHTML="";
}

//BROWSER STUFF

navigator.sayswho = ( function(){
var N= navigator.appName, ua= navigator.userAgent, tem;
var M= ua.match(/(opera|chrome|safari|firefox|msie)\/?\s*(\.?\d+(\.\d+)*)/i);
if(M && (tem= ua.match(/version\/([\.\d]+)/i))!= null) M[2]= tem[1];
M= M? [M[1], M[2]]: [N, navigator.appVersion,'-?'];
return M;
});
