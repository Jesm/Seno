'use strict';

var App = Jesm.createClass({

	__construct: function(root){
		var cvs = document.createElement('canvas');

		this.ctxt = cvs.getContext('2d');
		this.timestamp = {
			now: + new Date()
		};
		this.html = {
			canvas: cvs
		};

		Jesm.addEvento(cvs, 'click', this._click, this);
		Jesm.addEvento(window, 'resize', this._resize, this);
		root.appendChild(cvs);

		this._resize();
		this.drawFrame();
	},

	_resize: function(){
		var size = Jesm.Cross.inner(), cvs = this.html.canvas;
		cvs.width = size[0];
		cvs.height = size[1];
	},

	drawFrame:function(){
		requestAnimationFrame(this.drawFrame.bind(this)); // Requests new frame

		var now = + new Date();
		this.timestamp.elapsedTime = now - this.timestamp.now;
		this.timestamp.now = now;

		this.ctxt.clearRect(0, 0, this.html.canvas.width, this.html.canvas.height);

		if(this.click){
			this.click._calculateModifiers(this.timestamp);
			this.click.draw(this.ctxt);
		}
	},

	_click: function(ev){
		this.click = new Dot(this, ev.clientX, ev.clientY);
	}

});

App.getAsColorString = function(arr){
	arr = arr.slice();
	for(var len = arr.length; len--;)
		arr[len] = len == 3 ? arr[len].toFixed(4) : Math.round(arr[len]);
	return 'rgb' + (arr.length == 4 ? 'a' : '') + '(' + arr.join(',') + ')';
};

var AppElement = Jesm.createClass({

	__construct: function(app){
		// this.props = {};
		this.app = app;
		this._modifiers = {};
	},

	startModifier: function(str, toValue, duration){
		var arr = str.split('.'),
			currentValue = this._modifier(arr),
			modifiers = [];

		if(Array.isArray(currentValue)){
			var size = Math.min(currentValue.length, toValue.length);
			for(var len = size; len--;){
				var tmpArr = arr.slice();
				tmpArr.push(len);
				modifiers.push({
					propArr: tmpArr,
					easer: new Jesm.Easer(currentValue[len], toValue[len], duration).start()
				});
			}
		}
		else{
			modifiers.push({
				propArr: arr,
				easer: new Jesm.Easer(currentValue, toValue, duration).start()
			});
		}

		this._modifiers[str] = modifiers;
	},

	_calculateModifiers: function(timestamp){
		for(var key in this._modifiers){
			var arr = this._modifiers[key];

			for(var len = arr.length; len--;){
				var mod = arr[len],
					value = mod.easer.gerar(timestamp.now);

				this._modifier(mod.propArr, value);
				if(mod.easer.isComplete())
					arr.splice(len, 1);
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
	}

});

var Dot = AppElement.extend({

	__construct: function(app, x, y){
		this._super(app);

		this.x = x;
		this.y = y;
		this.diameter = 50;
		this.background = [200, 100, 0, 1];

		// this.startModifier('x', this.x * 2, 3);
		this.startModifier('diameter', this.diameter * 2, 3);
		this.startModifier('background', [255, 255, 255, 0], 3);
	},

	draw: function(ctxt){
		var path = new Path2D();
		path.arc(this.x, this.y, this.diameter, 0, Math.PI * 2, true);
		ctxt.fillStyle = App.getAsColorString(this.background);
		ctxt.fill(path);
	}

});