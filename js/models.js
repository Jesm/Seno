'use strict';

var App = Jesm.createClass({

	__construct: function(container){
		this.state = App.states.INITIALIZED;
		this.stages = [];

		var cvs = document.createElement('canvas');
		this.html = {
			canvas: cvs
		};

		// Jesm.addEvento(window, 'resize', this._resize, this);
		this._resize();
		container.appendChild(cvs);

		this.world = new AppWorld(this, cvs);
		this.world.start();
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
		var size = this.canvasSize,
			minorSize = Math.min.apply(Math, size);

		var mainCircle = new CentralCircle(this.world, size[0] / 2, size[1] / 2);
		mainCircle.diameter = minorSize * obj.mainCircleDiameter;
		if('mainCircleColor' in obj)
			mainCircle.background = obj.mainCircleColor;
		mainCircle.display();
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

var AppWorld = Jesm.createClass({

	__construct: function(app, canvas){
		this.app = app;
		this.elements = [];

		this._canvas = canvas;
		this._ctxt = canvas.getContext('2d');
	},

	start: function(){
		Jesm.addEvento(this._canvas, 'click', this._processClick, this);

		this.timestamp = {
			now: + new Date()
		};

		this.render();
	},

	addElement: function(obj){
		for(var x = 0, len = this.elements.length; x < len; x++){
			var element = this.elements[x];
			if(element.zIndex < obj.zIndex){
				this.elements.splice(x, 0, obj);
				return;
			}
		}

		this.elements.push(obj);
	},

	_processClick: function(ev){
		var coordinates = Jesm.Cross.getMouse(ev);

		for(var len = this.elements.length; len--;){
			var element = this.elements[len];

			if(Jesm.isFunction(element.processClick) && element.contains(coordinates)){
				element.processClick(coordinates);
				return;
			}
		}

		new Dot(this, ev.clientX, ev.clientY); // For test only
	},

	_sortElements: function(a, b){
		return b.zIndex - a.zIndex;
	},

	render: function(){
		requestAnimationFrame(this.render.bind(this)); // Requests new frame

		var now = + new Date();
		this.timestamp.elapsedTime = now - this.timestamp.now;
		this.timestamp.now = now;

		this._ctxt.clearRect(0, 0, this._canvas.width, this._canvas.height);
		this.elements.sort(this._sortElements);

		for(var len = this.elements.length; len--;){
			var element = this.elements[len];

			if(element._deleteInNextFrame){
				this.elements.splice(len, 1);
				continue;
			}

			element._calculateModifiers(this.timestamp);
			element.draw(this._ctxt);
		}
	}

});

var AppElement = Jesm.createClass({

	__construct: function(world){
		this.world = world;
		this._modifiers = {};
		this.zIndex = 1;
		this._deleteInNextFrame = false;

		this.world.addElement(this);
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

var AppCircle = AppElement.extend({

	__construct: function(world, x, y){
		this._super(world);

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
		ctxt.fillStyle = Array.isArray(this.background) ? App.getAsColorString(this.background) : this.background;
		ctxt.fill(path);
	}

});

var CentralCircle = AppCircle.extend({

	__construct: function(world, x, y){
		this._super.apply(this, arguments);
		this.ready = false;
	},

	display: function(){
		var finalDiameter = this.diameter;
		this.diameter = 0;

		this.startModifier('diameter', finalDiameter, 1, this._getReady);
	},

	_getReady: function(){
		this.ready = true;
	}

});