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
	
	var _total = _rate*_seconds;
	var _foo   = _total*0.125;
	var _fooi  = 0; 
	for (var _t = 0; _t < _total; _t++) {
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
		
		if (++_fooi >= _foo) {
			_fooi = 0;
			self.postMessage({msg:'progress', value: ((_t*1.0)/_total)});
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

self.addEventListener('message', function(e)
{
	try
	{
		var params = e.data;
		var generated = generateSound(params);
		self.postMessage({msg:'result', value: generated});
	}
	catch(err)
	{
		self.postMessage({msg:'error', value: err});
	}
  
}, false);
