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
		this.click = new Dot(ev.clientX, ev.clientY);
	}

});

var AppElement = Jesm.createClass({

	__construct: function(){
		// this.props = {};
		this._modifiers = [];
	},

	startModifier: function(str, toValue, duration){
		var arr = str.split('.'),
			easer = new Jesm.Easer(this._modifier(arr), toValue, duration);

		this._modifiers.push({
			propArr: arr,
			easer: easer.start()
		});
	},

	_calculateModifiers: function(timestamp){
		for(var len = this._modifiers.length; len--;){
			var mod = this._modifiers[len],
				value = mod.easer.gerar(timestamp.now);

			this._modifier(mod.propArr, value);
			if(mod.easer.isComplete())
				this._modifiers.splice(len, 1);
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

	__construct: function(x, y){
		this._super();

		this.x = x;
		this.y = y;
		this.diameter = 50;

		var self = this;
		setTimeout(function(){
			self.startModifier('x', self.x * 2, .5);
			self.startModifier('diameter', self.diameter * 2, .5);
		}, 2000);
	},

	draw: function(ctxt){
		var path = new Path2D();
		path.arc(this.x, this.y, this.diameter, 0, Math.PI * 2, true);
		ctxt.fillStyle = '#0F0';
		ctxt.fill(path);
	}

});