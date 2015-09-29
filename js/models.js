'use strict';

var App = Jesm.createClass({

	__construct: function(root){
		this.state = App.states.INITIALIZED;
		this.stages = [];

		var cvs = document.createElement('canvas');
		this.html = {
			canvas: cvs
		};

		// Jesm.addEvento(window, 'resize', this._resize, this);
		this._resize();
		root.appendChild(cvs);

		AppElement.startOn(cvs);
	},

	_resize: function(){
		this.canvasSize = Jesm.Cross.inner();
		this.html.canvas.width = this.canvasSize[0];
		this.html.canvas.height = this.canvasSize[1];
	},

	addStage: function(obj){
		this.stages.push(obj);
	},

	start: function(){
		if(!this.stages.length)
			throw 'There is no stage to play!';

		this.state = App.states.PLAYING;
		this.currentStageIndex = 0;
		this.loadStage(this.stages[this.currentStageIndex]);
	},

	loadStage: function(obj){
	}

});

App.states = {
	INITIALIZED: 1,
	PLAYING: 2
};

App.getAsColorString = function(arr){
	arr = arr.slice();
	for(var len = arr.length; len--;)
		arr[len] = len == 3 ? arr[len].toFixed(4) : Math.round(arr[len]);
	return 'rgb' + (arr.length == 4 ? 'a' : '') + '(' + arr.join(',') + ')';
};

var AppElement = Jesm.createClass({

	__construct: function(app){
		this.app = app;
		this._modifiers = {};
		this.zIndex = 1;
		this._deleteInNextFrame = false;

		AppElement.addInstance(this);
	},

	// Modifiers related methods

	startModifier: function(str, toValue, duration, callback){
		var arr = str.split('.'),
			currentValue = this._modifier(arr),
			obj = {
				list: [],
				callback: callback
			};

		if(Array.isArray(currentValue)){
			var size = Math.min(currentValue.length, toValue.length);
			for(var len = size; len--;){
				var tmpArr = arr.slice();
				tmpArr.push(len);
				obj.list.push({
					propArr: tmpArr,
					easer: new Jesm.Easer(currentValue[len], toValue[len], duration).start()
				});
			}
		}
		else{
			obj.list.push({
				propArr: arr,
				easer: new Jesm.Easer(currentValue, toValue, duration).start()
			});
		}

		this._modifiers[str] = obj;
	},

	_calculateModifiers: function(timestamp){
		for(var key in this._modifiers){
			var obj = this._modifiers[key],
				arr = obj.list,
				toEnd = arr.length;

			for(var len = arr.length; len--;){
				var mod = arr[len],
					value = mod.easer.gerar(timestamp.now);

				this._modifier(mod.propArr, value);
				if(mod.easer.isComplete()){
					arr.splice(len, 1);
					toEnd--;
				}
			}

			if(!toEnd){
				delete this._modifiers[key];
				if(Jesm.isFunction(obj.callback))
					obj.callback.call(this);
			}
		}
	},

	_modifier: function(arr, value){
		var obj = this, index = 0;
		for(var finalIndex = arr.length - 1; index < finalIndex; index++)
			obj = obj[arr[index]];
		if(value != null)
			obj[arr[index]] = value;
		return obj[arr[index]];
	},

	// Miscellaneous methods

	removeFromCanvas: function(){
		this._deleteInNextFrame = true;
	}

});

AppElement._instances = [];

AppElement.addInstance = function(obj){
	for(var x = 0, len = this._instances.length; x < len; x++){
		var element = this._instances[x];
		if(element.zIndex < obj.zIndex){
			this._instances.splice(x, 0, obj);
			return;
		}
	}

	this._instances.push(obj);
};

AppElement.startOn = function(canvas){
	this._canvas = canvas;
	this._ctxt = canvas.getContext('2d');

	Jesm.addEvento(canvas, 'click', this._processClick, this);

	this.timestamp = {
		now: + new Date()
	};

	this.render();
}

AppElement._processClick = function(ev){
	var coordinates = Jesm.Cross.getMouse(ev);

	for(var len = this._instances.length; len--;){
		var element = this._instances[len];

		if(element.contains(coordinates) && Jesm.isFunction(element.processClick)){
			element.processClick(coordinates);
			return;
		}
	}

	new Dot(null, ev.clientX, ev.clientY); // For test only
}

AppElement._sortElements = function(a, b){
	return b.zIndex - a.zIndex;
}

AppElement.render = function(){
	requestAnimationFrame(this.render.bind(this)); // Requests new frame

	var now = + new Date();
	this.timestamp.elapsedTime = now - this.timestamp.now;
	this.timestamp.now = now;

	this._ctxt.clearRect(0, 0, this._canvas.width, this._canvas.height);
	this._instances.sort(this._sortElements);

	for(var len = this._instances.length; len--;){
		var element = this._instances[len];

		if(element._deleteInNextFrame){
			this._instances.splice(len, 1);
			continue;
		}

		element._calculateModifiers(this.timestamp);
		element.draw(this._ctxt);
	}
}

var AppCircle = AppElement.extend({

	__construct: function(app, x, y){
		this._super(app);

		this.x = x || 0;
		this.y = y || 0;
		this.diameter = 10;
		this.background = [255, 255, 255, 1];
	},

	// Geometric methods

	contains: function(coordinates){
		return this.distanceTo(coordinates) < 0;
	},

	distanceTo: function(coordinates){
		var distance = Math.sqrt(
			Math.pow(this.x - coordinates[0], 2) +
			Math.pow(this.y - coordinates[1], 2)
		);
		distance -= this.diameter / 2;
		return distance;
	},

	draw: function(ctxt){
		var path = new Path2D();
		path.arc(this.x, this.y, this.diameter, 0, Math.PI * 2, true);
		ctxt.fillStyle = App.getAsColorString(this.background);
		ctxt.fill(path);
	}

});

var Dot = AppCircle.extend({

	__construct: function(app, x, y){
		this._super.apply(this, arguments);

		this.diameter = 50;
		this.background = [200, 100, 0, 1];

		// this.startModifier('x', this.x * 2, 3);
		this.startModifier('diameter', this.diameter * 2, 3);
		this.startModifier('background', [255, 255, 255, 0], 3, this.removeFromCanvas);
	}

});