'use strict';

var App = Jesm.createClass({

	__construct: function(container, params){
		this.state = App.states.INITIALIZED;
		this._levelCount = 0;
		this.html = {
			container: container
		};
		this._params = params;
	},

	start: function(){
		this.prepareTitleScreen();
		this.prepareGameWorld(this._params);
		delete this._params;
	},

	prepareTitleScreen: function(container){
		var html = this.html.container.innerHTML;
		this.html.container.innerHTML = '';

		this.html.titleScreen = Jesm.el('article', 'class=title-screen', this.html.container, html);
		this.html.titleScreen.classList.add('show');
		Jesm.addEvento(this.html.titleScreen, 'click', this.startGame, this);
	},

	prepareGameWorld: function(params){
		this.html.canvas = document.createElement('canvas');

		// Jesm.addEvento(window, 'resize', this._resize, this);
		this._resize();
		this.html.container.appendChild(this.html.canvas);

		this.params = this.convertParams(params);

		this.world = new AppWorld(this, this.html.canvas, {
			background: this.params.backgroundColor
		});
		this.world.start();
	},

	_resize: function(){
		this.canvasSize = Jesm.Cross.inner();
		this.html.canvas.width = this.canvasSize[0];
		this.html.canvas.height = this.canvasSize[1];
	},

	startGame: function(){
		if(this.state === App.states.PLAYING)
			return;

		this.unloadTitleScreen();

		this.state = App.states.PLAYING;

		this.targets = [];
		this.projectiles = [];
		this.createMainCircle();

		setTimeout((function(){
			this.loadLevel(this.getNextLevel());
		}).bind(this), 700);
	},

	unloadTitleScreen: function(){
		this.html.titleScreen.classList.add('hide');
	},

	convertParams: function(params){
		var strs = [
				'projectileVelocity',
				'mainCircleRadius',
				'targetRadius',
				'projectileRadius',
				'mainCircleTextFontSize'
			],
			obj = {},
			minorSize = Math.min.apply(Math, this.canvasSize);

		for(var key in params)
			obj[key] = strs.indexOf(key) > -1 ? params[key] * minorSize : params[key];
		return obj;
	},

	getNextLevel: function(){
		this._levelCount++;

		var level = {};
		for(var key in this.params)
			level[key] = this.params[key];

		level.number = this._levelCount;

		return level;
	},

	createMainCircle: function(){
		var size = this.canvasSize;
		this.mainCircle = new CentralCircle(this.world, size[0] / 2, size[1] / 2, {
			radius: 0,
			background: this.params.mainCircleColor,
			textColor: this.params.mainCircleTextColor,
			textFontSize: this.params.mainCircleTextFontSize,
			textFontFamily: this.params.mainCircleTextFontFamily,
			counterColor: this.params.mainCircleCounterColor
		});
		this.mainCircle.processClick = this.createProjectile.bind(this);
		this.mainCircle.modifyRadius(this.params.mainCircleRadius, 1);
	},

	loadLevel: function(level){
		this.currentLevel = level;
		this.projectileQuantityLeft = null;

		if(level.number > 1){
			// this.mainCircle.setText('Level ' + level.number);
			this.mainCircle.modifyRadius(level.mainCircleRadius, .5);
		}

		this.generateTargets(level);

		setTimeout((function(){
			this.startCurrentLevel();
		}).bind(this), 500);
	},

	generateTargets: function(level){
		for(var len = level.targetQuantity; len--;)
			this.createTarget(level);
	},

	createTarget: function(level){
		var radius = level.targetRadius,
			diameter = 2 * radius,
			circleCenter = this.mainCircle.getCenterAsArray(),
			minDistanceCenter = level.mainCircleRadius * 1.2 + radius,
			pos = [],
			pointRadians;

		do{
			for(var len = this.canvasSize.length; len--;)
				pos[len] = Math.round((this.canvasSize[len] - diameter) * Math.random() + radius);

			var totalDistance = App.distanceOfPoints(circleCenter, pos);
			pointRadians = App.getPointRadians(circleCenter, pos, totalDistance);

			if(totalDistance < minDistanceCenter){
				for(var len = this.canvasSize.length; len--;)
					pos[len] = circleCenter[len] + pointRadians[len] * minDistanceCenter;
			}

			var conflicts = false;
			for(var len = this.targets.length; len--;){
				var target = this.targets[len];
				if(App.distanceOfPoints(target.getCenterAsArray(), pos) < diameter){
					conflicts = true;
					break;
				}
			}
		} while(conflicts);

		var target = new Target(this.world, pos[0], pos[1], {
			pointRadians: pointRadians,
			radius: radius
		});
		this.targets.push(target);
	},

	startCurrentLevel: function(){
		this.projectileQuantityLeft = this.currentLevel.targetQuantity;
		var duration = this.currentLevel.counterDuration;
		this.mainCircle.initCounter(duration);
		this.timeoutRef = setTimeout(this.throwProjectiles.bind(this), duration * 1000);
	},

	createProjectile: function(position){
		if(!this.projectileQuantityLeft)
			return;

		var projectile = new Projectile(this.world, position[0], position[1], {
			radius: this.currentLevel.projectileRadius
		});
		this.projectiles.push(projectile);

		this.projectileQuantityLeft--;
		if(!this.projectileQuantityLeft)
			this.throwProjectiles();
	},

	throwProjectiles: function(){
		clearTimeout(this.timeoutRef);
		this.projectileQuantityLeft = null;
		this.mainCircle.resetCounter();

		this.state = App.states.WAITING;
		var center = this.mainCircle.getCenterAsArray();
		for(var len = this.projectiles.length; len--;){
			var projectile = this.projectiles[len];
			projectile.throwAway(center, this.currentLevel.projectileVelocity);
			// var hitlist = projectile.getHitlistOf(center, this.targets);
		}
	},

	verifyCollisions: function(){
		for(var len = this.projectiles.length; len--;){
			var projectile = this.projectiles[len];

			for(var len1 = this.targets.length; len1--;){
				var target = this.targets[len1];
				if(projectile.distanceToCircle(target) < 0){
					target.explode();
					this.targets.splice(len1, 1);
				}
			}

			if(projectile.isOutOfView()){
				projectile.removeFromCanvas();
				this.projectiles.splice(len, 1);
			}
		}

		if(!this.projectiles.length)
			this.endLevel();
	},

	endLevel: function(){
		this.state = App.states.PLAYING;

		var level = this.targets.length ? this.currentLevel : this.getNextLevel();
		this.unloadCurrentLevel();
		this.loadLevel(level);
	},

	unloadCurrentLevel: function(){
		for(;this.targets.length;){
			var target = this.targets.pop();
			target.implode();
		}

		delete this.currentLevel;
	}

});

App.states = {
	INITIALIZED: 1,
	PLAYING: 2,
	WAITING: 3
};

App.getAsColorString = function(arr){
	arr = arr.slice();
	for(var len = arr.length; len--;)
		arr[len] = len == 3 ? arr[len].toFixed(4) : Math.round(arr[len]);
	return 'rgb' + (arr.length == 4 ? 'a' : '') + '(' + arr.join(',') + ')';
};

App.distanceOfPoints = function(pos1, pos2){
	return Math.sqrt(
		Math.pow(pos1[0] - pos2[0], 2) +
		Math.pow(pos1[1] - pos2[1], 2)
	);
};

App.getPointRadians = function(origin, currentPos, currentDistance){
	var strs = ['cos', 'sin'],
		arr = [];

	for(var len = origin.length; len--;){
		var name = strs[len],
			distance = currentPos[len] - origin[len],
			value = currentDistance ? distance / currentDistance : len,
			radians = Math['a' + name](value);

		arr[len] = Math[name](radians);
	}

	return arr;
}

App.getTime = function(){
	return + new Date();
}

var AppWorld = Jesm.createClass({

	__construct: function(app, canvas, params){
		this.app = app;
		this.elements = [];

		this._canvas = canvas;
		this._ctxt = canvas.getContext('2d');
		this.background = params.background;
	},

	start: function(){
		Jesm.addEvento(this._canvas, 'mousedown', this._processClick, this);

		this.timestamp = {
			now: App.getTime()
		};

		this.render();
	},

	addElement: function(obj){
		for(var x = 0, len = this.elements.length; x < len; x++){
			var element = this.elements[x];
			if(obj.zIndex >= element.zIndex){
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
	},

	_sortElements: function(a, b){
		return b.zIndex - a.zIndex;
	},

	getSize: function(){
		return [this._canvas.width, this._canvas.height];
	},

	render: function(){
		requestAnimationFrame(this.render.bind(this)); // Requests new frame

		var now = App.getTime();
		this.timestamp.elapsedTime = now - this.timestamp.now;
		this.timestamp.now = now;

		this._ctxt.fillStyle = this.background;
		this._ctxt.fillRect(0, 0, this._canvas.width, this._canvas.height);
		this.elements.sort(this._sortElements);

		for(var len = this.elements.length; len--;){
			var element = this.elements[len];

			if(element._deleteInNextFrame){
				this.elements.splice(len, 1);
				continue;
			}

			element._calculateModifiers(this.timestamp);
			element.draw(this._ctxt, this.timestamp);
		}

		if(this.app.state === App.states.WAITING)
			this.app.verifyCollisions();
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

	startModifier: function(str, toValue, duration, callback, type){
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
					easer: new Jesm.Easer(currentValue[len], toValue[len], duration, type).start()
				});
			}
		}
		else{
			obj.list.push({
				propArr: arr,
				easer: new Jesm.Easer(currentValue, toValue, duration, type).start()
			});
		}

		this._modifiers[str] = obj;
	},

	startPerpetualModifier: function(str, callback){
		var arr = str.split('.'),
			currentValue = this._modifier(arr),
			obj = {
				list: [],
				callback: callback,
				perpetual: true
			};

		if(Array.isArray(currentValue)){
			var size = Math.min(currentValue.length, toValue.length);
			for(var len = size; len--;){
				var tmpArr = arr.slice();
				tmpArr.push(len);
				obj.list.push({
					propArr: tmpArr
				});
			}
		}
		else{
			obj.list.push({
				propArr: arr
			});
		}

		this._modifiers[str] = obj;
	},

	_calculateModifiers: function(timestamp){
		for(var key in this._modifiers){
			var name = this._modifiers[key].perpetual ? '_calculatePerpetualModifier' : '_calculateModifier';
			this[name](timestamp, key);
		}
	},

	_calculateModifier: function(timestamp, key){
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
	},

	_calculatePerpetualModifier: function(timestamp, key){
		var obj = this._modifiers[key],
			arr = obj.list;

		for(var len = arr.length; len--;){
			var mod = arr[len],
				value = this._modifier(mod.propArr);

			value = obj.callback.call(this, timestamp, value);
			this._modifier(mod.propArr, value);
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

	stopModifier: function(str){
		delete this._modifiers[str];
	},

	// Miscellaneous methods

	removeFromCanvas: function(){
		this._deleteInNextFrame = true;
	},

	drawCircle: function(ctxt, x, y, radius, background, startAngle, endAngle){
		var path = new Path2D();
		path.arc(x, y, radius, startAngle || 0, endAngle == null ? Math.PI * 2 : endAngle);
		ctxt.fillStyle = Array.isArray(background) ? App.getAsColorString(background) : background;
		ctxt.fill(path);
	}

});

var AppCircle = AppElement.extend({

	__construct: function(world, x, y){
		this._super(world);

		this.x = x || 0;
		this.y = y || 0;
		this.radius = 5;
		this.background = [255, 255, 255, 1];
	},

	// Geometric methods

	contains: function(coordinates){
		return this.distanceTo(coordinates) < 0;
	},

	distanceTo: function(coordinates){
		return App.distanceOfPoints(this.getCenterAsArray(), coordinates) - this.radius;
	},

	distanceToCircle: function(circle){
		return this.distanceTo(circle.getCenterAsArray()) - circle.radius;
	},

	getCenterAsArray: function(){
		return [this.x, this.y];
	},

	isOutOfView: function(){
		var center = this.getCenterAsArray(),
			size = this.world.getSize();

		for(var len = center.length; len--;){
			var middle = size[len] / 2;

			if(Math.abs(center[len] - middle) >= middle + this.radius)
				return true;
		}

		return false;
	},

	draw: function(ctxt){
		this.drawCircle(ctxt, this.x, this.y, this.radius, this.background);
	}

});

var CentralCircle = AppCircle.extend({

	__construct: function(world, x, y, obj){
		this._super.apply(this, arguments);

		this.radius = obj.radius;
		if('background' in obj)
			this.background = obj.background;

		this.textColor = obj.textColor;
		this.textFontSize = obj.textFontSize;
		this.textFontFamily = obj.textFontFamily;
		this.counterColor = obj.counterColor;
	},

	modifyRadius: function(value, duration){
		this.startModifier('radius', value, duration || 1);
	},

	initCounter: function(duration){
		this.counterValue = duration;
		this.startModifier('counterValue', 0, duration, null, 'linear');

		this.counterAngle = Math.PI * 2;
		this.startModifier('counterAngle', 0, duration, null, 'linear');
	},

	resetCounter: function(){
		this.stopModifier('counterValue');
		this.startModifier('counterAngle', 0, .1, null, 'linear');
		this.counterValue = null;
	},

	draw: function(ctxt, timestamp){
		this._super.apply(this, arguments);

		if(this.counterAngle){
			ctxt.beginPath();
			ctxt.moveTo(this.x, this.y);
			ctxt.arc(this.x, this.y, this.radius, 0, this.counterAngle);
			ctxt.closePath();
			ctxt.fillStyle = this.counterColor;
			ctxt.fill();

			this.drawCircle(ctxt, this.x, this.y, this.radius * .75, this.background);
		}

		if(this.counterValue)
			this.drawText(ctxt, Math.ceil(this.counterValue));
	},

	drawText: function(ctxt, str){
		ctxt.fillStyle = this.textColor;
		ctxt.font = this.textFontSize + 'px ' + this.textFontFamily;
		ctxt.textBaseline = 'middle';

		var metrics = ctxt.measureText(str);
		ctxt.fillText(str, Math.round(this.x - metrics.width / 2), this.y);
	}

});

var Projectile = AppCircle.extend({

	__construct: function(world, x, y, params){
		this._super.apply(this, arguments);

		this.radius = params.radius;
	},

	throwAway: function(coordinates, velocity){
		var center = this.getCenterAsArray(),
			distance = App.distanceOfPoints(coordinates, center);

		this.pointRadians = App.getPointRadians(coordinates, center, distance);
		this.velocity = velocity;

		this.startPerpetualModifier('x', this.moveXAxis);
		this.startPerpetualModifier('y', this.moveYAxis);
	},

	getEquationOfRect: function(coordinates){
		var center = this.getCenterAsArray(),
			A = center[1] - coordinates[1],
			B = coordinates[0] - center[0],
			C = center[0] * coordinates[1] - center[1] * coordinates[0];

		return [A, B, C];
	},

	getHitlistOf: function(coordinates, targets){
		var arr = [],
			equation = this.getEquationOfRect(coordinates);

		for(var len = targets.length; len--;){
			var target = targets[len],
				targetCenter = target.getCenterAsArray(),
				numerator = Math.abs(equation[0] * targetCenter[0] + equation[1] * targetCenter[1] + equation[2]),
				denominator = Math.sqrt(Math.pow(equation[0], 2) + Math.pow(equation[1], 2)),
				distance = numerator / denominator;

			if(distance < this.radius + target.radius)
				arr.push(target);
		}

		return arr;
	},

	moveXAxis: function(timestamp, value){
		return this.moveAxis(timestamp, value, 0);
	},
	moveYAxis: function(timestamp, value){
		return this.moveAxis(timestamp, value, 1);
	},

	moveAxis: function(timestamp, value, index){
		return value + this.pointRadians[index] * this.velocity * timestamp.elapsedTime;
	}

});

var Target = AppCircle.extend({

	__construct: function(world, x, y, params){
		this._super.apply(this, arguments);

		this.radius = 0;
		this.background = [255, 255, 255, 1];
		this.startModifier('radius', params.radius, .5);
	},

	explode: function(){
		this.destroy(this.radius * 3);
	},
	implode: function(){
		this.destroy(this.radius / 3);
	},

	destroy: function(radius){
		this.startModifier('radius', radius, .3);
		this.startModifier('background', [255, 255, 255, 0], .3, this.removeFromCanvas);
	}

});