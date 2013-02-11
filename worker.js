// Code in ~2 hours by Bemmu, idea and sound code snippet from Viznut.
// 2011-09-30 - Modifications by raer.
// 2011-10-07 - Modifications by raer.
// Last modifications by budsan: https://github.com/budsan/funck

function ProgressPost(size, rate) {
	this.sizeInv = 1.0/size;
	this.rate    = size * rate;
	this.total   = 0;
	this.curr    = 0;
}

ProgressPost.prototype.step = function() {
	this.total++;
	this.curr++;
	if (this.curr >= this.rate) {
		this.curr = 0;
		var value = Math.min(1.0, this.total * this.sizeInv);
		self.postMessage({msg:'progress', value: value});
	}
}

function DummyProgressPost() {}
DummyProgressPost.prototype.step = function() {}

function generateSound(params, notificate) {
	//private
	var _rate = params.rate;
	var _depth = params.depth;
	var _seconds = params.duration;
	var _channels = 1;
	var _f1 = null, _f2 = null;
	var _samples = [];
	var _curChan = 0;
	
	var _post = null;
	var _buildNotificator = null;

	if (typeof notificate === 'undefined') {
		_buildNotificator = function(total) {
			return new DummyProgressPost();
		}
	} else {
		_buildNotificator = function(total) {
			return new ProgressPost(total, 0.05);
		}
	}

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
	var thisline = new Error().lineNumber;
	try {eval (params.aux);}
	catch(ex) {
		if(thisline) {
			
			throw "Aux in line " + (ex.lineNumber-thisline) + " | " + ex.toString();
		}
		else {
			throw "Aux | " + ex.toString();
		}
	}

	try {eval("_f1 = function () { return " + params.oneliner + ";}");}
	catch(ex) {throw "Left | " + ex.toString();}
	if (params.oneliner2 != "") {
		try {eval("_f2 = function () { return " + params.oneliner2 + ";}");}
		catch(ex) {throw "Right | " + ex.toString();}
		
		_channels = 2;
		s = function(i, chan) {
			if (typeof chan === 'undefined') chan = _curChan;
			i *= _channels;
			if (i >= 0 && i < _samples.length) return _samples[i+chan];
			return 0;
		};
	}
	
	var _prog = _buildNotificator(_rate*_seconds);
	for (var _t = 0; _t < _rate*_seconds; _t++) {
		// just in case this vars are modified.
		t = _t; 
		rate = _rate;

		//left channel
		var _sample;
		try {_sample = _f1();}
		catch(ex) {throw "Runtime Left | " + ex.toString();};

		var _sample2;
		if (_channels > 1 && _f2 != null) {
			//right channel
			_curChan = 1;
			try {_sample2 = _f2();}
			catch(ex) {throw "Runtime Right | " + ex.toString();};
			_curChan = 0;
		}
		//store left sample
		_samples.push(_sample);
		//store right sample if any
		if (_channels > 1 && _f2 != null) {
			_samples.push(_sample2);
		}
		
		_prog.step();
	}

	switch(_depth) {
		case 'fnorm':
			_prog = _buildNotificator(_samples.length*2);
			_min =  1.7976931348623157E+10308, // Infinity
			_max = -1.7976931348623157E+10308; //-Infinity
			for(var i = 0; i < _samples.length; i++) {
				var _sample = _samples[i];
				if (_sample < _min) _min = _sample;
				if (_sample > _max) _max = _sample;
				_prog.step();
			}
			
			_d = 1.0 / ((_max - _min) * 0.5);
			for(var i = 0; i < _samples.length; i++) {
				var _sample = _samples[i];
				_samples[i] = ((_sample-_min)*_d) - 1.0;
				_prog.step();
			}
		case 'fclamp':
			_prog = _buildNotificator(_samples.length);
			for(var i = 0; i < _samples.length; i++) {
				var _sample = _samples[i];
				if (_sample < -1.0) _sample = -1.0;
				if (_sample >  1.0) _sample =  1.0;
				_sample = parseInt(_sample * 32767);
				if (_sample < 0) _sample += 65536
				_samples[i] = _sample;
				_prog.step();
			}
		break;
		case '16bits':
			_prog = _buildNotificator(_samples.length);
			for(var i = 0; i < _samples.length; i++) {
				var _sample = parseInt(_samples[i]);
				_sample = (_sample & 0xffff);
				if (_sample < 0) _sample = 0;
				if (_sample > 65535) _sample = 65535;
				_samples[i] = _sample;
				_prog.step();
			}
		break;
		case '8bits':
		default:
			_prog = _buildNotificator(_samples.length);
			for(var i = 0; i < _samples.length; i++) {
				var _sample = parseInt(_samples[i]);
				_sample = (_sample & 0xff) * 256;
				if (_sample < 0) _sample = 0;
				if (_sample > 65535) _sample = 65535;
				_samples[i] = _sample;
				_prog.step();
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
		var generated = generateSound(params, true);
		self.postMessage({msg:'result', value: generated});
	}
	catch(err)
	{
		if (typeof err === 'string') {
			self.postMessage({msg:'error', value: err});
		}
		else {
			var vDebug = ""; 
			for (var prop in err)  {  
				vDebug += "property: "+ prop+ " value: ["+ err[prop]+ "]<br/>\n";
			} 
			vDebug += "toString(): " + " value: [" + err.toString() + "]";
			self.postMessage({msg:'error', value: vDebug});
		}
		
	}
  
}, false);
