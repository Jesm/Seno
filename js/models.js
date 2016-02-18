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

	loadStage: function(params){
		this.currentStageParams = params;

		var size = this.canvasSize,
			minorSize = Math.min.apply(Math, size);

		this.mainCircleRadius = minorSize * params.mainCircleRadius;
		this.targetRadius = minorSize * params.targetRadius;
		this.projectileRadius = minorSize * params.projectileRadius;
		this.projectileVelocity = minorSize * params.projectileVelocity;

		this.targets = [];
		this.projectiles = [];
		this.projectileQuantityLeft = null;

		this.currentMainCircle = new CentralCircle(this.world, size[0] / 2, size[1] / 2, {
			radius: this.mainCircleRadius,
			background: params.mainCircleColor,
			textColor: params.mainCircleTextColor,
			textFontSize: params.mainCircleTextFontSize,
			textFontFamily: params.mainCircleTextFontFamily
		});

		this.currentMainCircle.processClick = this.createProjectile.bind(this);

		setTimeout(this.startCounter.bind(this), 700);
	},

	startCounter: function(){
		this.generateTargets();

		setTimeout(this.startStage.bind(this), 600);
	},

	generateTargets: function(){
		for(var len = this.currentStageParams.targetQuantity; len--;)
			this.createTarget();
	},

	createTarget: function(){
		var radius = this.targetRadius,
			diameter = 2 * radius,
			circleCenter = this.currentMainCircle.getCenterAsArray(),
			minDistanceCenter = this.mainCircleRadius * 1.2 + radius,
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

	startStage: function(){
		this.stageCounter = this.currentStageParams.counterDuration;
		this.currentMainCircle.setCounter(this.stageCounter);
		this.projectileQuantityLeft = this.currentStageParams.targetQuantity;
		this.counterIntervalRef = setInterval(this.updateCounter.bind(this), 1000);
	},

	createProjectile: function(position){
		if(!this.projectileQuantityLeft)
			return;

		var projectile = new Projectile(this.world, position[0], position[1], {
			radius: this.projectileRadius
		});
		this.projectiles.push(projectile);

		this.projectileQuantityLeft--;
		if(!this.projectileQuantityLeft)
			this.throwProjectiles();
	},

	updateCounter: function(){
		this.currentMainCircle.setCounter(--this.stageCounter);
		if(this.stageCounter <= 0)
			this.throwProjectiles();
	},

	throwProjectiles: function(){
		clearInterval(this.counterIntervalRef);
		this.projectileQuantityLeft = null;
		this.currentMainCircle.setCounter();

		this.state = App.states.WAITING;
		var center = this.currentMainCircle.getCenterAsArray();
		for(var len = this.projectiles.length; len--;){
			var projectile = this.projectiles[len];
			// projectile.throwAway(center, this.projectileVelocity);
			var hitlist = projectile.getHitlistOf(center, this.targets);
			debugger
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
			this.verifyStageScore();
	},

	verifyStageScore: function(){
		this.state = App.states.PLAYING;

		alert('Targets left: ' + this.targets.length);
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

var AppWorld = Jesm.createClass({

	__construct: function(app, canvas){
		this.app = app;
		this.elements = [];

		this._canvas = canvas;
		this._ctxt = canvas.getContext('2d');
	},

	start: function(){
		Jesm.addEvento(this._canvas, 'mousedown', this._processClick, this);

		this.timestamp = {
			now: + new Date()
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
		var path = new Path2D();
		path.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
		ctxt.fillStyle = Array.isArray(this.background) ? App.getAsColorString(this.background) : this.background;
		ctxt.fill(path);
	}

});

var CentralCircle = AppCircle.extend({

	__construct: function(world, x, y, obj){
		this._super.apply(this, arguments);

		this.radius = 0;
		if('background' in obj)
			this.background = obj.background;

		this.textColor = obj.textColor;
		this.textFontSize = obj.textFontSize;
		this.textFontFamily = obj.textFontFamily;

		this.startModifier('radius', obj.radius, 1);
	},

	setCounter: function(value){
		this.counterValue = value;
	},

	draw: function(ctxt){
		this._super.apply(this, arguments);

		if(this.counterValue != null){
			ctxt.fillStyle = this.textColor;
			ctxt.font = this.textFontSize + 'px ' + this.textFontFamily;
			ctxt.textBaseline = 'middle';

			var str = this.counterValue,
				metrics = ctxt.measureText(str);

			ctxt.fillText(str, Math.round(this.x - metrics.width / 2), this.y);
		}
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