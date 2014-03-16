"use strict";
(function() {

Error.stackTraceLimit = -1;

var go$reservedKeywords = ["abstract", "arguments", "boolean", "break", "byte", "case", "catch", "char", "class", "const", "continue", "debugger", "default", "delete", "do", "double", "else", "enum", "eval", "export", "extends", "false", "final", "finally", "float", "for", "function", "goto", "if", "implements", "import", "in", "instanceof", "int", "interface", "let", "long", "native", "new", "package", "private", "protected", "public", "return", "short", "static", "super", "switch", "synchronized", "this", "throw", "throws", "transient", "true", "try", "typeof", "var", "void", "volatile", "while", "with", "yield"];

var go$global;
if (typeof window !== "undefined") {
	go$global = window;
} else if (typeof GLOBAL !== "undefined") {
	go$global = GLOBAL;
}

var go$idCounter = 0;
var go$keys = function(m) { return m ? Object.keys(m) : []; };
var go$min = Math.min;
var go$parseInt = parseInt;
var go$parseFloat = parseFloat;
var go$toString = String;
var go$reflect, go$newStringPtr;
var Go$Array = Array;
var Go$Error = Error;

var go$floatKey = function(f) {
	if (f !== f) {
		go$idCounter++;
		return "NaN$" + go$idCounter;
	}
	return String(f);
};

var go$mapArray = function(array, f) {
	var newArray = new array.constructor(array.length), i;
	for (i = 0; i < array.length; i++) {
		newArray[i] = f(array[i]);
	}
	return newArray;
};

var go$newType = function(size, kind, string, name, pkgPath, constructor) {
	var typ;
	switch(kind) {
	case "Bool":
	case "Int":
	case "Int8":
	case "Int16":
	case "Int32":
	case "Uint":
	case "Uint8" :
	case "Uint16":
	case "Uint32":
	case "Uintptr":
	case "String":
	case "UnsafePointer":
		typ = function(v) { this.go$val = v; };
		typ.prototype.go$key = function() { return string + "$" + this.go$val; };
		break;

	case "Float32":
	case "Float64":
		typ = function(v) { this.go$val = v; };
		typ.prototype.go$key = function() { return string + "$" + go$floatKey(this.go$val); };
		break;

	case "Int64":
		typ = function(high, low) {
			this.high = (high + Math.floor(Math.ceil(low) / 4294967296)) >> 0;
			this.low = low >>> 0;
			this.go$val = this;
		};
		typ.prototype.go$key = function() { return string + "$" + this.high + "$" + this.low; };
		break;

	case "Uint64":
		typ = function(high, low) {
			this.high = (high + Math.floor(Math.ceil(low) / 4294967296)) >>> 0;
			this.low = low >>> 0;
			this.go$val = this;
		};
		typ.prototype.go$key = function() { return string + "$" + this.high + "$" + this.low; };
		break;

	case "Complex64":
	case "Complex128":
		typ = function(real, imag) {
			this.real = real;
			this.imag = imag;
			this.go$val = this;
		};
		typ.prototype.go$key = function() { return string + "$" + this.real + "$" + this.imag; };
		break;

	case "Array":
		typ = function(v) { this.go$val = v; };
		typ.Ptr = go$newType(4, "Ptr", "*" + string, "", "", function(array) {
			this.go$get = function() { return array; };
			this.go$val = array;
		});
		typ.init = function(elem, len) {
			typ.elem = elem;
			typ.len = len;
			typ.prototype.go$key = function() {
				return string + "$" + go$mapArray(this.go$val, function(e) {
					var key = e.go$key ? e.go$key() : String(e);
					return key.replace(/\\/g, "\\\\").replace(/\$/g, "\\$");
				}).join("$");
			};
			typ.extendReflectType = function(rt) {
				rt.arrayType = new go$reflect.arrayType(rt, elem.reflectType(), undefined, len);
			};
			typ.Ptr.init(typ);
		};
		break;

	case "Chan":
		typ = function() { this.go$val = this; };
		typ.prototype.go$key = function() {
			if (this.go$id === undefined) {
				go$idCounter++;
				this.go$id = go$idCounter;
			}
			return String(this.go$id);
		};
		typ.init = function(elem, sendOnly, recvOnly) {
			typ.nil = new typ();
			typ.extendReflectType = function(rt) {
				rt.chanType = new go$reflect.chanType(rt, elem.reflectType(), sendOnly ? go$reflect.SendDir : (recvOnly ? go$reflect.RecvDir : go$reflect.BothDir));
			};
		};
		break;

	case "Func":
		typ = function(v) { this.go$val = v; };
		typ.init = function(params, results, variadic) {
			typ.params = params;
			typ.results = results;
			typ.variadic = variadic;
			typ.extendReflectType = function(rt) {
				var typeSlice = (go$sliceType(go$ptrType(go$reflect.rtype)));
				rt.funcType = new go$reflect.funcType(rt, variadic, new typeSlice(go$mapArray(params, function(p) { return p.reflectType(); })), new typeSlice(go$mapArray(results, function(p) { return p.reflectType(); })));
			};
		};
		break;

	case "Interface":
		typ = { implementedBy: [] };
		typ.init = function(methods) {
			typ.extendReflectType = function(rt) {
				var imethods = go$mapArray(methods, function(m) {
					return new go$reflect.imethod(go$newStringPtr(m[0]), go$newStringPtr(m[1]), m[2].reflectType());
				});
				var methodSlice = (go$sliceType(go$ptrType(go$reflect.imethod)));
				rt.interfaceType = new go$reflect.interfaceType(rt, new methodSlice(imethods));
			};
		};
		break;

	case "Map":
		typ = function(v) { this.go$val = v; };
		typ.init = function(key, elem) {
			typ.key = key;
			typ.elem = elem;
			typ.extendReflectType = function(rt) {
				rt.mapType = new go$reflect.mapType(rt, key.reflectType(), elem.reflectType(), undefined, undefined);
			};
		};
		break;

	case "Ptr":
		typ = constructor || function(getter, setter) {
			this.go$get = getter;
			this.go$set = setter;
			this.go$val = this;
		};
		typ.prototype.go$key = function() {
			if (this.go$id === undefined) {
				go$idCounter++;
				this.go$id = go$idCounter;
			}
			return String(this.go$id);
		};
		typ.init = function(elem) {
			typ.nil = new typ(go$throwNilPointerError, go$throwNilPointerError);
			typ.extendReflectType = function(rt) {
				rt.ptrType = new go$reflect.ptrType(rt, elem.reflectType());
			};
		};
		break;

	case "Slice":
		var nativeArray;
		typ = function(array) {
			if (array.constructor !== nativeArray) {
				array = new nativeArray(array);
			}
			this.array = array;
			this.offset = 0;
			this.length = array.length;
			this.capacity = array.length;
			this.go$val = this;
		};
		typ.make = function(length, capacity, zero) {
			capacity = capacity || length;
			var array = new nativeArray(capacity), i;
			for (i = 0; i < capacity; i++) {
				array[i] = zero();
			}
			var slice = new typ(array);
			slice.length = length;
			return slice;
		};
		typ.init = function(elem) {
			typ.elem = elem;
			nativeArray = go$nativeArray(elem.kind);
			typ.nil = new typ([]);
			typ.extendReflectType = function(rt) {
				rt.sliceType = new go$reflect.sliceType(rt, elem.reflectType());
			};
		};
		break;

	case "Struct":
		typ = function(v) { this.go$val = v; };
		typ.Ptr = go$newType(4, "Ptr", "*" + string, "", "", constructor);
		typ.Ptr.Struct = typ;
		typ.init = function(fields) {
			var i;
			typ.fields = fields;
			typ.Ptr.init(typ);
			// nil value
			typ.Ptr.nil = new constructor();
			for (i = 0; i < fields.length; i++) {
				var field = fields[i];
				Object.defineProperty(typ.Ptr.nil, field[1], { get: go$throwNilPointerError, set: go$throwNilPointerError });
			}
			// methods for embedded fields
			for (i = 0; i < typ.methods.length; i++) {
				var method = typ.methods[i];
				if (method[5] != -1) {
					(function(field, methodName) {
						typ.prototype[methodName] = function() {
							var v = this.go$val[field[0]];
							return v[methodName].apply(v, arguments);
						};
					})(fields[method[5]], method[0]);
				}
			}
			for (i = 0; i < typ.Ptr.methods.length; i++) {
				var method = typ.Ptr.methods[i];
				if (method[5] != -1) {
					(function(field, methodName) {
						typ.Ptr.prototype[methodName] = function() {
							var v = this[field[0]];
							if (v.go$val === undefined) {
								v = new field[3](v);
							}
							return v[methodName].apply(v, arguments);
						};
					})(fields[method[5]], method[0]);
				}
			}
			// map key
			typ.prototype.go$key = function() {
				var keys = new Array(fields.length);
				for (i = 0; i < fields.length; i++) {
					var v = this.go$val[fields[i][0]];
					var key = v.go$key ? v.go$key() : String(v);
					keys[i] = key.replace(/\\/g, "\\\\").replace(/\$/g, "\\$");
				}
				return string + "$" + keys.join("$");
			};
			// reflect type
			typ.extendReflectType = function(rt) {
				var reflectFields = new Array(fields.length), i;
				for (i = 0; i < fields.length; i++) {
					var field = fields[i];
					reflectFields[i] = new go$reflect.structField(go$newStringPtr(field[1]), go$newStringPtr(field[2]), field[3].reflectType(), go$newStringPtr(field[4]), i);
				}
				rt.structType = new go$reflect.structType(rt, new (go$sliceType(go$reflect.structField))(reflectFields));
			};
		};
		break;

	default:
		throw go$panic(new Go$String("invalid kind: " + kind));
	}

	typ.kind = kind;
	typ.string = string;
	typ.typeName = name;
	typ.pkgPath = pkgPath;
	typ.methods = [];
	var rt = null;
	typ.reflectType = function() {
		if (rt === null) {
			rt = new go$reflect.rtype(size, 0, 0, 0, 0, go$reflect.kinds[kind], undefined, undefined, go$newStringPtr(string), undefined, undefined);
			rt.jsType = typ;

			var methods = [];
			if (typ.methods !== undefined) {
				var i;
				for (i = 0; i < typ.methods.length; i++) {
					var m = typ.methods[i];
					methods.push(new go$reflect.method(go$newStringPtr(m[0]), go$newStringPtr(m[1]), go$funcType(m[2], m[3], m[4]).reflectType(), go$funcType([typ].concat(m[2]), m[3], m[4]).reflectType(), undefined, undefined));
				}
			}
			if (name !== "" || methods.length !== 0) {
				var methodSlice = (go$sliceType(go$ptrType(go$reflect.method)));
				rt.uncommonType = new go$reflect.uncommonType(go$newStringPtr(name), go$newStringPtr(pkgPath), new methodSlice(methods));
			}

			if (typ.extendReflectType !== undefined) {
				typ.extendReflectType(rt);
			}
		}
		return rt;
	};
	return typ;
};

var Go$Bool          = go$newType( 1, "Bool",          "bool",           "bool",       "", null);
var Go$Int           = go$newType( 4, "Int",           "int",            "int",        "", null);
var Go$Int8          = go$newType( 1, "Int8",          "int8",           "int8",       "", null);
var Go$Int16         = go$newType( 2, "Int16",         "int16",          "int16",      "", null);
var Go$Int32         = go$newType( 4, "Int32",         "int32",          "int32",      "", null);
var Go$Int64         = go$newType( 8, "Int64",         "int64",          "int64",      "", null);
var Go$Uint          = go$newType( 4, "Uint",          "uint",           "uint",       "", null);
var Go$Uint8         = go$newType( 1, "Uint8",         "uint8",          "uint8",      "", null);
var Go$Uint16        = go$newType( 2, "Uint16",        "uint16",         "uint16",     "", null);
var Go$Uint32        = go$newType( 4, "Uint32",        "uint32",         "uint32",     "", null);
var Go$Uint64        = go$newType( 8, "Uint64",        "uint64",         "uint64",     "", null);
var Go$Uintptr       = go$newType( 4, "Uintptr",       "uintptr",        "uintptr",    "", null);
var Go$Float32       = go$newType( 4, "Float32",       "float32",        "float32",    "", null);
var Go$Float64       = go$newType( 8, "Float64",       "float64",        "float64",    "", null);
var Go$Complex64     = go$newType( 8, "Complex64",     "complex64",      "complex64",  "", null);
var Go$Complex128    = go$newType(16, "Complex128",    "complex128",     "complex128", "", null);
var Go$String        = go$newType( 0, "String",        "string",         "string",     "", null);
var Go$UnsafePointer = go$newType( 4, "UnsafePointer", "unsafe.Pointer", "Pointer",    "", null);

var go$nativeArray = function(elemKind) {
	return ({ Int: Int32Array, Int8: Int8Array, Int16: Int16Array, Int32: Int32Array, Uint: Uint32Array, Uint8: Uint8Array, Uint16: Uint16Array, Uint32: Uint32Array, Uintptr: Uint32Array, Float32: Float32Array, Float64: Float64Array })[elemKind] || Array;
};
var go$toNativeArray = function(elemKind, array) {
	var nativeArray = go$nativeArray(elemKind);
	if (nativeArray === Array) {
		return array;
	}
	return new nativeArray(array);
};
var go$makeNativeArray = function(elemKind, length, zero) {
	var array = new (go$nativeArray(elemKind))(length), i;
	for (i = 0; i < length; i++) {
		array[i] = zero();
	}
	return array;
};
var go$arrayTypes = {};
var go$arrayType = function(elem, len) {
	var string = "[" + len + "]" + elem.string;
	var typ = go$arrayTypes[string];
	if (typ === undefined) {
		typ = go$newType(0, "Array", string, "", "", null);
		typ.init(elem, len);
		go$arrayTypes[string] = typ;
	}
	return typ;
};

var go$chanType = function(elem, sendOnly, recvOnly) {
	var string = (recvOnly ? "<-" : "") + "chan" + (sendOnly ? "<- " : " ") + elem.string;
	var field = sendOnly ? "SendChan" : (recvOnly ? "RecvChan" : "Chan");
	var typ = elem[field];
	if (typ === undefined) {
		typ = go$newType(0, "Chan", string, "", "", null);
		typ.init(elem, sendOnly, recvOnly);
		elem[field] = typ;
	}
	return typ;
};

var go$funcTypes = {};
var go$funcType = function(params, results, variadic) {
	var paramTypes = go$mapArray(params, function(p) { return p.string; });
	if (variadic) {
		paramTypes[paramTypes.length - 1] = "..." + paramTypes[paramTypes.length - 1].substr(2);
	}
	var string = "func(" + paramTypes.join(", ") + ")";
	if (results.length === 1) {
		string += " " + results[0].string;
	} else if (results.length > 1) {
		string += " (" + go$mapArray(results, function(r) { return r.string; }).join(", ") + ")";
	}
	var typ = go$funcTypes[string];
	if (typ === undefined) {
		typ = go$newType(0, "Func", string, "", "", null);
		typ.init(params, results, variadic);
		go$funcTypes[string] = typ;
	}
	return typ;
};

var go$interfaceTypes = {};
var go$interfaceType = function(methods) {
	var string = "interface {}";
	if (methods.length !== 0) {
		string = "interface { " + go$mapArray(methods, function(m) {
			return (m[1] !== "" ? m[1] + "." : "") + m[0] + m[2].string.substr(4);
		}).join("; ") + " }";
	}
	var typ = go$interfaceTypes[string];
	if (typ === undefined) {
		typ = go$newType(0, "Interface", string, "", "", null);
		typ.init(methods);
		go$interfaceTypes[string] = typ;
	}
	return typ;
};
var go$emptyInterface = go$interfaceType([]);
var go$interfaceNil = { go$key: function() { return "nil"; } };
var go$error = go$newType(8, "Interface", "error", "error", "", null);
go$error.init([["Error", "", go$funcType([], [Go$String], false)]]);

var Go$Map = function() {};
(function() {
	var names = Object.getOwnPropertyNames(Object.prototype), i;
	for (i = 0; i < names.length; i++) {
		Go$Map.prototype[names[i]] = undefined;
	}
})();
var go$mapTypes = {};
var go$mapType = function(key, elem) {
	var string = "map[" + key.string + "]" + elem.string;
	var typ = go$mapTypes[string];
	if (typ === undefined) {
		typ = go$newType(0, "Map", string, "", "", null);
		typ.init(key, elem);
		go$mapTypes[string] = typ;
	}
	return typ;
};

var go$throwNilPointerError = function() { go$throwRuntimeError("invalid memory address or nil pointer dereference"); };
var go$ptrType = function(elem) {
	var typ = elem.Ptr;
	if (typ === undefined) {
		typ = go$newType(0, "Ptr", "*" + elem.string, "", "", null);
		typ.init(elem);
		elem.Ptr = typ;
	}
	return typ;
};

var go$sliceType = function(elem) {
	var typ = elem.Slice;
	if (typ === undefined) {
		typ = go$newType(0, "Slice", "[]" + elem.string, "", "", null);
		typ.init(elem);
		elem.Slice = typ;
	}
	return typ;
};

var go$structTypes = {};
var go$structType = function(fields) {
	var string = "struct { " + go$mapArray(fields, function(f) {
		return f[1] + " " + f[3].string + (f[4] !== "" ? (' "' + f[4].replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"') : "");
	}).join("; ") + " }";
	var typ = go$structTypes[string];
	if (typ === undefined) {
		typ = go$newType(0, "Struct", string, "", "", function() {
			this.go$val = this;
			var i;
			for (i = 0; i < fields.length; i++) {
				this[fields[i][0]] = arguments[i];
			}
		});
		typ.init(fields);
		go$structTypes[string] = typ;
	}
	return typ;
};

var go$stringPtrMap = new Go$Map();
go$newStringPtr = function(str) {
	if (str === undefined || str === "") {
		return go$ptrType(Go$String).nil;
	}
	var ptr = go$stringPtrMap[str];
	if (ptr === undefined) {
		ptr = new (go$ptrType(Go$String))(function() { return str; }, function(v) { str = v; });
		go$stringPtrMap[str] = ptr;
	}
	return ptr;
};
var go$newDataPointer = function(data, constructor) {
	return new constructor(function() { return data; }, function(v) { data = v; });
};

var go$ldexp = function(frac, exp) {
	if (frac === 0) { return frac; }
	if (exp >= 1024) { return frac * Math.pow(2, 1023) * Math.pow(2, exp - 1023); }
	if (exp <= -1024) { return frac * Math.pow(2, -1023) * Math.pow(2, exp + 1023); }
	return frac * Math.pow(2, exp);
};
var go$float32bits = function(f) {
	var s, e, r;
	if (f === 0) {
		if (f === 0 && 1 / f === 1 / -0) {
			return 2147483648;
		}
		return 0;
	}
	if (f !== f) {
		return 2143289344;
	}
	s = 0;
	if (f < 0) {
		s = 2147483648;
		f = -f;
	}
	e = 150;
	while (f >= 1.6777216e+07) {
		f = f / 2;
		if (e === 255) {
			break;
		}
		e = e + 1 >>> 0;
	}
	while (f < 8.388608e+06) {
		e = e - 1 >>> 0;
		if (e === 0) {
			break;
		}
		f = f * 2;
	}
	r = f % 2;
	if ((r > 0.5 && r < 1) || r >= 1.5) {
		f++;
	}
	return (((s | (e << 23 >>> 0)) >>> 0) | (((f >> 0) & ~8388608))) >>> 0;
};
var go$float32frombits = function(b) {
	var s, e, m;
	s = 1;
	if (((b & 2147483648) >>> 0) !== 0) {
		s = -1;
	}
	e = (((b >>> 23 >>> 0)) & 255) >>> 0;
	m = (b & 8388607) >>> 0;
	if (e === 255) {
		if (m === 0) {
			return s / 0;
		}
		return 0/0;
	}
	if (e !== 0) {
		m = m + 8388608 >>> 0;
	}
	if (e === 0) {
		e = 1;
	}
	return go$ldexp(m, e - 127 - 23) * s;
};

var go$flatten64 = function(x) {
	return x.high * 4294967296 + x.low;
};
var go$shiftLeft64 = function(x, y) {
	if (y === 0) {
		return x;
	}
	if (y < 32) {
		return new x.constructor(x.high << y | x.low >>> (32 - y), (x.low << y) >>> 0);
	}
	if (y < 64) {
		return new x.constructor(x.low << (y - 32), 0);
	}
	return new x.constructor(0, 0);
};
var go$shiftRightInt64 = function(x, y) {
	if (y === 0) {
		return x;
	}
	if (y < 32) {
		return new x.constructor(x.high >> y, (x.low >>> y | x.high << (32 - y)) >>> 0);
	}
	if (y < 64) {
		return new x.constructor(x.high >> 31, (x.high >> (y - 32)) >>> 0);
	}
	if (x.high < 0) {
		return new x.constructor(-1, 4294967295);
	}
	return new x.constructor(0, 0);
};
var go$shiftRightUint64 = function(x, y) {
	if (y === 0) {
		return x;
	}
	if (y < 32) {
		return new x.constructor(x.high >>> y, (x.low >>> y | x.high << (32 - y)) >>> 0);
	}
	if (y < 64) {
		return new x.constructor(0, x.high >>> (y - 32));
	}
	return new x.constructor(0, 0);
};
var go$mul64 = function(x, y) {
	var high = 0, low = 0, i;
	if ((y.low & 1) !== 0) {
		high = x.high;
		low = x.low;
	}
	for (i = 1; i < 32; i++) {
		if ((y.low & 1<<i) !== 0) {
			high += x.high << i | x.low >>> (32 - i);
			low += (x.low << i) >>> 0;
		}
	}
	for (i = 0; i < 32; i++) {
		if ((y.high & 1<<i) !== 0) {
			high += x.low << i;
		}
	}
	return new x.constructor(high, low);
};
var go$div64 = function(x, y, returnRemainder) {
	if (y.high === 0 && y.low === 0) {
		go$throwRuntimeError("integer divide by zero");
	}

	var s = 1;
	var rs = 1;

	var xHigh = x.high;
	var xLow = x.low;
	if (xHigh < 0) {
		s = -1;
		rs = -1;
		xHigh = -xHigh;
		if (xLow !== 0) {
			xHigh--;
			xLow = 4294967296 - xLow;
		}
	}

	var yHigh = y.high;
	var yLow = y.low;
	if (y.high < 0) {
		s *= -1;
		yHigh = -yHigh;
		if (yLow !== 0) {
			yHigh--;
			yLow = 4294967296 - yLow;
		}
	}

	var high = 0, low = 0, n = 0, i;
	while (yHigh < 2147483648 && ((xHigh > yHigh) || (xHigh === yHigh && xLow > yLow))) {
		yHigh = (yHigh << 1 | yLow >>> 31) >>> 0;
		yLow = (yLow << 1) >>> 0;
		n++;
	}
	for (i = 0; i <= n; i++) {
		high = high << 1 | low >>> 31;
		low = (low << 1) >>> 0;
		if ((xHigh > yHigh) || (xHigh === yHigh && xLow >= yLow)) {
			xHigh = xHigh - yHigh;
			xLow = xLow - yLow;
			if (xLow < 0) {
				xHigh--;
				xLow += 4294967296;
			}
			low++;
			if (low === 4294967296) {
				high++;
				low = 0;
			}
		}
		yLow = (yLow >>> 1 | yHigh << (32 - 1)) >>> 0;
		yHigh = yHigh >>> 1;
	}

	if (returnRemainder) {
		return new x.constructor(xHigh * rs, xLow * rs);
	}
	return new x.constructor(high * s, low * s);
};

var go$divComplex = function(n, d) {
	var ninf = n.real === 1/0 || n.real === -1/0 || n.imag === 1/0 || n.imag === -1/0;
	var dinf = d.real === 1/0 || d.real === -1/0 || d.imag === 1/0 || d.imag === -1/0;
	var nnan = !ninf && (n.real !== n.real || n.imag !== n.imag);
	var dnan = !dinf && (d.real !== d.real || d.imag !== d.imag);
	if(nnan || dnan) {
		return new n.constructor(0/0, 0/0);
	}
	if (ninf && !dinf) {
		return new n.constructor(1/0, 1/0);
	}
	if (!ninf && dinf) {
		return new n.constructor(0, 0);
	}
	if (d.real === 0 && d.imag === 0) {
		if (n.real === 0 && n.imag === 0) {
			return new n.constructor(0/0, 0/0);
		}
		return new n.constructor(1/0, 1/0);
	}
	var a = Math.abs(d.real);
	var b = Math.abs(d.imag);
	if (a <= b) {
		var ratio = d.real / d.imag;
		var denom = d.real * ratio + d.imag;
		return new n.constructor((n.real * ratio + n.imag) / denom, (n.imag * ratio - n.real) / denom);
	}
	var ratio = d.imag / d.real;
	var denom = d.imag * ratio + d.real;
	return new n.constructor((n.imag * ratio + n.real) / denom, (n.imag - n.real * ratio) / denom);
};

var go$subslice = function(slice, low, high, max) {
	if (low < 0 || high < low || max < high || high > slice.capacity || max > slice.capacity) {
		go$throwRuntimeError("slice bounds out of range");
	}
	var s = new slice.constructor(slice.array);
	s.offset = slice.offset + low;
	s.length = slice.length - low;
	s.capacity = slice.capacity - low;
	if (high !== undefined) {
		s.length = high - low;
	}
	if (max !== undefined) {
		s.capacity = max - low;
	}
	return s;
};

var go$sliceToArray = function(slice) {
	if (slice.length === 0) {
		return [];
	}
	if (slice.array.constructor !== Array) {
		return slice.array.subarray(slice.offset, slice.offset + slice.length);
	}
	return slice.array.slice(slice.offset, slice.offset + slice.length);
};

var go$decodeRune = function(str, pos) {
	var c0 = str.charCodeAt(pos);

	if (c0 < 0x80) {
		return [c0, 1];
	}

	if (c0 !== c0 || c0 < 0xC0) {
		return [0xFFFD, 1];
	}

	var c1 = str.charCodeAt(pos + 1);
	if (c1 !== c1 || c1 < 0x80 || 0xC0 <= c1) {
		return [0xFFFD, 1];
	}

	if (c0 < 0xE0) {
		var r = (c0 & 0x1F) << 6 | (c1 & 0x3F);
		if (r <= 0x7F) {
			return [0xFFFD, 1];
		}
		return [r, 2];
	}

	var c2 = str.charCodeAt(pos + 2);
	if (c2 !== c2 || c2 < 0x80 || 0xC0 <= c2) {
		return [0xFFFD, 1];
	}

	if (c0 < 0xF0) {
		var r = (c0 & 0x0F) << 12 | (c1 & 0x3F) << 6 | (c2 & 0x3F);
		if (r <= 0x7FF) {
			return [0xFFFD, 1];
		}
		if (0xD800 <= r && r <= 0xDFFF) {
			return [0xFFFD, 1];
		}
		return [r, 3];
	}

	var c3 = str.charCodeAt(pos + 3);
	if (c3 !== c3 || c3 < 0x80 || 0xC0 <= c3) {
		return [0xFFFD, 1];
	}

	if (c0 < 0xF8) {
		var r = (c0 & 0x07) << 18 | (c1 & 0x3F) << 12 | (c2 & 0x3F) << 6 | (c3 & 0x3F);
		if (r <= 0xFFFF || 0x10FFFF < r) {
			return [0xFFFD, 1];
		}
		return [r, 4];
	}

	return [0xFFFD, 1];
};

var go$encodeRune = function(r) {
	if (r < 0 || r > 0x10FFFF || (0xD800 <= r && r <= 0xDFFF)) {
		r = 0xFFFD;
	}
	if (r <= 0x7F) {
		return String.fromCharCode(r);
	}
	if (r <= 0x7FF) {
		return String.fromCharCode(0xC0 | r >> 6, 0x80 | (r & 0x3F));
	}
	if (r <= 0xFFFF) {
		return String.fromCharCode(0xE0 | r >> 12, 0x80 | (r >> 6 & 0x3F), 0x80 | (r & 0x3F));
	}
	return String.fromCharCode(0xF0 | r >> 18, 0x80 | (r >> 12 & 0x3F), 0x80 | (r >> 6 & 0x3F), 0x80 | (r & 0x3F));
};

var go$stringToBytes = function(str, terminateWithNull) {
	var array = new Uint8Array(terminateWithNull ? str.length + 1 : str.length), i;
	for (i = 0; i < str.length; i++) {
		array[i] = str.charCodeAt(i);
	}
	if (terminateWithNull) {
		array[str.length] = 0;
	}
	return array;
};

var go$bytesToString = function(slice) {
	if (slice.length === 0) {
		return "";
	}
	var str = "", i;
	for (i = 0; i < slice.length; i += 10000) {
		str += String.fromCharCode.apply(null, slice.array.subarray(slice.offset + i, slice.offset + Math.min(slice.length, i + 10000)));
	}
	return str;
};

var go$stringToRunes = function(str) {
	var array = new Int32Array(str.length);
	var rune, i, j = 0;
	for (i = 0; i < str.length; i += rune[1], j++) {
		rune = go$decodeRune(str, i);
		array[j] = rune[0];
	}
	return array.subarray(0, j);
};

var go$runesToString = function(slice) {
	if (slice.length === 0) {
		return "";
	}
	var str = "", i;
	for (i = 0; i < slice.length; i++) {
		str += go$encodeRune(slice.array[slice.offset + i]);
	}
	return str;
};

var go$needsExternalization = function(t) {
	switch (t.kind) {
		case "Int64":
		case "Uint64":
		case "Array":
		case "Func":
		case "Interface":
		case "Map":
		case "Slice":
		case "String":
			return true;
		default:
			return false;
	}
};

var go$externalize = function(v, t) {
	switch (t.kind) {
	case "Int64":
	case "Uint64":
		return go$flatten64(v);
	case "Array":
		if (go$needsExternalization(t.elem)) {
			return go$mapArray(v, function(e) { return go$externalize(e, t.elem); });
		}
		return v;
	case "Func":
		if (v === go$throwNilPointerError) {
			return null;
		}
		var convert = false;
		var i;
		for (i = 0; i < t.params.length; i++) {
			convert = convert || (t.params[i] !== go$packages["github.com/gopherjs/gopherjs/js"].Object);
		}
		for (i = 0; i < t.results.length; i++) {
			convert = convert || go$needsExternalization(t.results[i]);
		}
		if (!convert) {
			return v;
		}
		return function() {
			var args = [], i;
			for (i = 0; i < t.params.length; i++) {
				if (t.variadic && i === t.params.length - 1) {
					var vt = t.params[i].elem, varargs = [], j;
					for (j = i; j < arguments.length; j++) {
						varargs.push(go$internalize(arguments[j], vt));
					}
					args.push(new (t.params[i])(varargs));
					break;
				}
				args.push(go$internalize(arguments[i], t.params[i]));
			}
			var result = v.apply(undefined, args);
			switch (t.results.length) {
			case 0:
				return;
			case 1:
				return go$externalize(result, t.results[0]);
			default:
				for (i = 0; i < t.results.length; i++) {
					result[i] = go$externalize(result[i], t.results[i]);
				}
				return result;
			}
		};
	case "Interface":
		if (v === null) {
			return null;
		}
		if (v.constructor.kind === undefined) {
			return v; // js.Object
		}
		return go$externalize(v.go$val, v.constructor);
	case "Map":
		var m = {};
		var keys = go$keys(v), i;
		for (i = 0; i < keys.length; i++) {
			var entry = v[keys[i]];
			m[go$externalize(entry.k, t.key)] = go$externalize(entry.v, t.elem);
		}
		return m;
	case "Slice":
		if (go$needsExternalization(t.elem)) {
			return go$mapArray(go$sliceToArray(v), function(e) { return go$externalize(e, t.elem); });
		}
		return go$sliceToArray(v);
	case "String":
		var s = "", r, i, j = 0;
		for (i = 0; i < v.length; i += r[1], j++) {
			r = go$decodeRune(v, i);
			s += String.fromCharCode(r[0]);
		}
		return s;
	case "Struct":
		var timePkg = go$packages["time"];
		if (timePkg && v.constructor === timePkg.Time.Ptr) {
			var milli = go$div64(v.UnixNano(), new Go$Int64(0, 1000000));
			return new Date(go$flatten64(milli));
		}
		return v;
	default:
		return v;
	}
};

var go$internalize = function(v, t, recv) {
	switch (t.kind) {
	case "Bool":
		return !!v;
	case "Int":
		return parseInt(v);
	case "Int8":
		return parseInt(v) << 24 >> 24;
	case "Int16":
		return parseInt(v) << 16 >> 16;
	case "Int32":
		return parseInt(v) >> 0;
	case "Uint":
		return parseInt(v);
	case "Uint8" :
		return parseInt(v) << 24 >>> 24;
	case "Uint16":
		return parseInt(v) << 16 >>> 16;
	case "Uint32":
	case "Uintptr":
		return parseInt(v) >>> 0;
	case "Int64":
	case "Uint64":
		return new t(0, v);
	case "Float32":
	case "Float64":
		return parseFloat(v);
	case "Array":
		if (v.length !== t.len) {
			go$throwRuntimeError("got array with wrong size from JavaScript native");
		}
		return go$mapArray(v, function(e) { return go$internalize(e, t.elem); });
	case "Func":
		return function() {
			var args = [], i;
			for (i = 0; i < t.params.length; i++) {
				if (t.variadic && i === t.params.length - 1) {
					var vt = t.params[i].elem, varargs = arguments[i], j;
					for (j = 0; j < varargs.length; j++) {
						args.push(go$externalize(varargs.array[varargs.offset + j], vt));
					}
					break;
				}
				args.push(go$externalize(arguments[i], t.params[i]));
			}
			var result = v.apply(recv, args);
			switch (t.results.length) {
			case 0:
				return;
			case 1:
				return go$internalize(result, t.results[0]);
			default:
				for (i = 0; i < t.results.length; i++) {
					result[i] = go$internalize(result[i], t.results[i]);
				}
				return result;
			}
		};
	case "Interface":
		if (t === go$packages["github.com/gopherjs/gopherjs/js"].Object) {
			return v;
		}
		switch (v.constructor) {
		case Int8Array:
			return new (go$sliceType(Go$Int8))(v);
		case Int16Array:
			return new (go$sliceType(Go$Int16))(v);
		case Int32Array:
			return new (go$sliceType(Go$Int))(v);
		case Uint8Array:
			return new (go$sliceType(Go$Uint8))(v);
		case Uint16Array:
			return new (go$sliceType(Go$Uint16))(v);
		case Uint32Array:
			return new (go$sliceType(Go$Uint))(v);
		case Float32Array:
			return new (go$sliceType(Go$Float32))(v);
		case Float64Array:
			return new (go$sliceType(Go$Float64))(v);
		case Array:
			return go$internalize(v, go$sliceType(go$emptyInterface));
		case Boolean:
			return new Go$Bool(!!v);
		case Date:
			var timePkg = go$packages["time"];
			if (timePkg) {
				return new timePkg.Time(timePkg.Unix(new Go$Int64(0, 0), new Go$Int64(0, v.getTime() * 1000000)));
			}
		case Function:
			var funcType = go$funcType([go$sliceType(go$emptyInterface)], [go$packages["github.com/gopherjs/gopherjs/js"].Object], true);
			return new funcType(go$internalize(v, funcType));
		case Number:
			return new Go$Float64(parseFloat(v));
		case Object:
			var mapType = go$mapType(Go$String, go$emptyInterface);
			return new mapType(go$internalize(v, mapType));
		case String:
			return new Go$String(go$internalize(v, Go$String));
		}
		return v;
	case "Map":
		var m = new Go$Map();
		var keys = go$keys(v), i;
		for (i = 0; i < keys.length; i++) {
			var key = go$internalize(keys[i], t.key);
			m[key.go$key ? key.go$key() : key] = { k: key, v: go$internalize(v[keys[i]], t.elem) };
		}
		return m;
	case "Slice":
		return new t(go$mapArray(v, function(e) { return go$internalize(e, t.elem); }));
	case "String":
		v = String(v);
		var s = "", i;
		for (i = 0; i < v.length; i++) {
			s += go$encodeRune(v.charCodeAt(i));
		}
		return s;
	default:
		return v;
	}
};

var go$copySlice = function(dst, src) {
	var n = Math.min(src.length, dst.length), i;
	if (dst.array.constructor !== Array && n !== 0) {
		dst.array.set(src.array.subarray(src.offset, src.offset + n), dst.offset);
		return n;
	}
	for (i = 0; i < n; i++) {
		dst.array[dst.offset + i] = src.array[src.offset + i];
	}
	return n;
};

var go$copyString = function(dst, src) {
	var n = Math.min(src.length, dst.length), i;
	for (i = 0; i < n; i++) {
		dst.array[dst.offset + i] = src.charCodeAt(i);
	}
	return n;
};

var go$copyArray = function(dst, src) {
	var i;
	for (i = 0; i < src.length; i++) {
		dst[i] = src[i];
	}
};

var go$growSlice = function(slice, length) {
	var newCapacity = Math.max(length, slice.capacity < 1024 ? slice.capacity * 2 : Math.floor(slice.capacity * 5 / 4));

	var newArray;
	if (slice.array.constructor === Array) {
		newArray = slice.array;
		if (slice.offset !== 0 || newArray.length !== slice.offset + slice.capacity) {
			newArray = newArray.slice(slice.offset);
		}
		newArray.length = newCapacity;
	} else {
		newArray = new slice.array.constructor(newCapacity);
		newArray.set(slice.array.subarray(slice.offset));
	}

	var newSlice = new slice.constructor(newArray);
	newSlice.length = slice.length;
	newSlice.capacity = newCapacity;
	return newSlice;
};

var go$append = function(slice) {
	if (arguments.length === 1) {
		return slice;
	}

	var newLength = slice.length + arguments.length - 1;
	if (newLength > slice.capacity) {
		slice = go$growSlice(slice, newLength);
	}

	var array = slice.array;
	var leftOffset = slice.offset + slice.length - 1, i;
	for (i = 1; i < arguments.length; i++) {
		array[leftOffset + i] = arguments[i];
	}

	var newSlice = new slice.constructor(array);
	newSlice.offset = slice.offset;
	newSlice.length = newLength;
	newSlice.capacity = slice.capacity;
	return newSlice;
};

var go$appendSlice = function(slice, toAppend) {
	if (toAppend.length === 0) {
		return slice;
	}

	var newLength = slice.length + toAppend.length;
	if (newLength > slice.capacity) {
		slice = go$growSlice(slice, newLength);
	}

	var array = slice.array;
	var leftOffset = slice.offset + slice.length, rightOffset = toAppend.offset, i;
	for (i = 0; i < toAppend.length; i++) {
		array[leftOffset + i] = toAppend.array[rightOffset + i];
	}

	var newSlice = new slice.constructor(array);
	newSlice.offset = slice.offset;
	newSlice.length = newLength;
	newSlice.capacity = slice.capacity;
	return newSlice;
};

var go$panic = function(value) {
	var message;
	if (value.constructor === Go$String) {
		message = value.go$val;
	} else if (value.Error !== undefined) {
		message = value.Error();
	} else if (value.String !== undefined) {
		message = value.String();
	} else {
		message = value;
	}
	var err = new Error(message);
	err.go$panicValue = value;
	return err;
};
var go$notSupported = function(feature) {
	var err = new Error("not supported by GopherJS: " + feature);
	err.go$notSupported = feature;
	throw err;
};
var go$throwRuntimeError; // set by package "runtime"

var go$errorStack = [], go$jsErr = null;

var go$pushErr = function(err) {
	if (err.go$panicValue === undefined) {
		var jsPkg = go$packages["github.com/gopherjs/gopherjs/js"];
		if (err.go$notSupported !== undefined || jsPkg === undefined) {
			go$jsErr = err;
			return;
		}
		err.go$panicValue = new jsPkg.Error.Ptr(err);
	}
	go$errorStack.push({ frame: go$getStackDepth(), error: err });
};

var go$callDeferred = function(deferred) {
	if (go$jsErr !== null) {
		throw go$jsErr;
	}
	var i;
	for (i = deferred.length - 1; i >= 0; i--) {
		var call = deferred[i];
		try {
			if (call.recv !== undefined) {
				call.recv[call.method].apply(call.recv, call.args);
				continue;
			}
			call.fun.apply(undefined, call.args);
		} catch (err) {
			go$errorStack.push({ frame: go$getStackDepth(), error: err });
		}
	}
	var err = go$errorStack[go$errorStack.length - 1];
	if (err !== undefined && err.frame === go$getStackDepth()) {
		go$errorStack.pop();
		throw err.error;
	}
};

var go$recover = function() {
	var err = go$errorStack[go$errorStack.length - 1];
	if (err === undefined || err.frame !== go$getStackDepth()) {
		return null;
	}
	go$errorStack.pop();
	return err.error.go$panicValue;
};

var go$getStack = function() {
	return (new Error()).stack.split("\n");
};

var go$getStackDepth = function() {
	var s = go$getStack(), d = 0, i;
	for (i = 0; i < s.length; i++) {
		if (s[i].indexOf("go$") === -1) {
			d++;
		}
	}
	return d;
};

var go$interfaceIsEqual = function(a, b) {
	if (a === null || b === null) {
		return a === null && b === null;
	}
	if (a.constructor !== b.constructor) {
		return false;
	}
	switch (a.constructor.kind) {
	case "Float32":
		return go$float32IsEqual(a.go$val, b.go$val);
	case "Complex64":
		return go$float32IsEqual(a.go$val.real, b.go$val.real) && go$float32IsEqual(a.go$val.imag, b.go$val.imag);
	case "Complex128":
		return a.go$val.real === b.go$val.real && a.go$val.imag === b.go$val.imag;
	case "Int64":
	case "Uint64":
		return a.go$val.high === b.go$val.high && a.go$val.low === b.go$val.low;
	case "Array":
		return go$arrayIsEqual(a.go$val, b.go$val);
	case "Ptr":
		if (a.constructor.Struct) {
			return a === b;
		}
		return go$pointerIsEqual(a, b);
	case "Func":
	case "Map":
	case "Slice":
	case "Struct":
		go$throwRuntimeError("comparing uncomparable type " + a.constructor);
	case undefined: // js.Object
		return a === b;
	default:
		return a.go$val === b.go$val;
	}
};
var go$float32IsEqual = function(a, b) {
	return a === a && b === b && go$float32bits(a) === go$float32bits(b);
}
var go$arrayIsEqual = function(a, b) {
	if (a.length != b.length) {
		return false;
	}
	var i;
	for (i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			return false;
		}
	}
	return true;
};
var go$sliceIsEqual = function(a, ai, b, bi) {
	return a.array === b.array && a.offset + ai === b.offset + bi;
};
var go$pointerIsEqual = function(a, b) {
	if (a === b) {
		return true;
	}
	if (a.go$get === go$throwNilPointerError || b.go$get === go$throwNilPointerError) {
		return a.go$get === go$throwNilPointerError && b.go$get === go$throwNilPointerError;
	}
	var old = a.go$get();
	var dummy = new Object();
	a.go$set(dummy);
	var equal = b.go$get() === dummy;
	a.go$set(old);
	return equal;
};

var go$typeAssertionFailed = function(obj, expected) {
	var got = "";
	if (obj !== null) {
		got = obj.constructor.string;
	}
	throw go$panic(new go$packages["runtime"].TypeAssertionError.Ptr("", got, expected.string, ""));
};

var go$now = function() { var msec = (new Date()).getTime(); return [new Go$Int64(0, Math.floor(msec / 1000)), (msec % 1000) * 1000000]; };

var go$packages = {};
go$packages["runtime"] = (function() {
	var go$pkg = {}, TypeAssertionError, errorString, sizeof_C_MStats;
	TypeAssertionError = go$pkg.TypeAssertionError = go$newType(0, "Struct", "runtime.TypeAssertionError", "TypeAssertionError", "runtime", function(interfaceString_, concreteString_, assertedString_, missingMethod_) {
		this.go$val = this;
		this.interfaceString = interfaceString_ !== undefined ? interfaceString_ : "";
		this.concreteString = concreteString_ !== undefined ? concreteString_ : "";
		this.assertedString = assertedString_ !== undefined ? assertedString_ : "";
		this.missingMethod = missingMethod_ !== undefined ? missingMethod_ : "";
	});
	errorString = go$pkg.errorString = go$newType(0, "String", "runtime.errorString", "errorString", "runtime", null);
	TypeAssertionError.Ptr.prototype.RuntimeError = function() {
	};
	TypeAssertionError.prototype.RuntimeError = function() { return this.go$val.RuntimeError(); };
	TypeAssertionError.Ptr.prototype.Error = function() {
		var e, inter;
		e = this;
		inter = e.interfaceString;
		if (inter === "") {
			inter = "interface";
		}
		if (e.concreteString === "") {
			return "interface conversion: " + inter + " is nil, not " + e.assertedString;
		}
		if (e.missingMethod === "") {
			return "interface conversion: " + inter + " is " + e.concreteString + ", not " + e.assertedString;
		}
		return "interface conversion: " + e.concreteString + " is not " + e.assertedString + ": missing method " + e.missingMethod;
	};
	TypeAssertionError.prototype.Error = function() { return this.go$val.Error(); };
	errorString.prototype.RuntimeError = function() {
		var e;
		e = this.go$val;
	};
	go$ptrType(errorString).prototype.RuntimeError = function() { return new errorString(this.go$get()).RuntimeError(); };
	errorString.prototype.Error = function() {
		var e;
		e = this.go$val;
		return "runtime error: " + e;
	};
	go$ptrType(errorString).prototype.Error = function() { return new errorString(this.go$get()).Error(); };

			go$throwRuntimeError = function(msg) { throw go$panic(new errorString(msg)); };
			go$pkg.init = function() {
		(go$ptrType(TypeAssertionError)).methods = [["Error", "", [], [Go$String], false, -1], ["RuntimeError", "", [], [], false, -1]];
		TypeAssertionError.init([["interfaceString", "interfaceString", "runtime", Go$String, ""], ["concreteString", "concreteString", "runtime", Go$String, ""], ["assertedString", "assertedString", "runtime", Go$String, ""], ["missingMethod", "missingMethod", "runtime", Go$String, ""]]);
		errorString.methods = [["Error", "", [], [Go$String], false, -1], ["RuntimeError", "", [], [], false, -1]];
		(go$ptrType(errorString)).methods = [["Error", "", [], [Go$String], false, -1], ["RuntimeError", "", [], [], false, -1]];
		sizeof_C_MStats = 3712;
		if (!((sizeof_C_MStats === 3712))) {
			console.log(sizeof_C_MStats, 3712);
			throw go$panic(new Go$String("MStats vs MemStatsType size mismatch"));
		}
	}
	return go$pkg;
})();
go$packages["github.com/gopherjs/gopherjs/js"] = (function() {
	var go$pkg = {}, Object, Error;
	Object = go$pkg.Object = go$newType(0, "Interface", "js.Object", "Object", "github.com/gopherjs/gopherjs/js", null);
	Error = go$pkg.Error = go$newType(0, "Struct", "js.Error", "Error", "github.com/gopherjs/gopherjs/js", function(Object_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
	});
	Error.Ptr.prototype.Error = function() {
		var err;
		err = this;
		return "JavaScript error: " + go$internalize(err.Object.message, Go$String);
	};
	Error.prototype.Error = function() { return this.go$val.Error(); };
	go$pkg.init = function() {
		Object.init([["Bool", "", (go$funcType([], [Go$Bool], false))], ["Call", "", (go$funcType([Go$String, (go$sliceType(go$emptyInterface))], [Object], true))], ["Float", "", (go$funcType([], [Go$Float64], false))], ["Get", "", (go$funcType([Go$String], [Object], false))], ["Index", "", (go$funcType([Go$Int], [Object], false))], ["Int", "", (go$funcType([], [Go$Int], false))], ["Interface", "", (go$funcType([], [go$emptyInterface], false))], ["Invoke", "", (go$funcType([(go$sliceType(go$emptyInterface))], [Object], true))], ["IsNull", "", (go$funcType([], [Go$Bool], false))], ["IsUndefined", "", (go$funcType([], [Go$Bool], false))], ["Length", "", (go$funcType([], [Go$Int], false))], ["New", "", (go$funcType([(go$sliceType(go$emptyInterface))], [Object], true))], ["Set", "", (go$funcType([Go$String, go$emptyInterface], [], false))], ["SetIndex", "", (go$funcType([Go$Int, go$emptyInterface], [], false))], ["String", "", (go$funcType([], [Go$String], false))]]);
		Error.methods = [["Bool", "", [], [Go$Bool], false, 0], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [Object], true, 0], ["Float", "", [], [Go$Float64], false, 0], ["Get", "", [Go$String], [Object], false, 0], ["Index", "", [Go$Int], [Object], false, 0], ["Int", "", [], [Go$Int], false, 0], ["Interface", "", [], [go$emptyInterface], false, 0], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [Object], true, 0], ["IsNull", "", [], [Go$Bool], false, 0], ["IsUndefined", "", [], [Go$Bool], false, 0], ["Length", "", [], [Go$Int], false, 0], ["New", "", [(go$sliceType(go$emptyInterface))], [Object], true, 0], ["Set", "", [Go$String, go$emptyInterface], [], false, 0], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false, 0], ["String", "", [], [Go$String], false, 0]];
		(go$ptrType(Error)).methods = [["Bool", "", [], [Go$Bool], false, 0], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [Object], true, 0], ["Error", "", [], [Go$String], false, -1], ["Float", "", [], [Go$Float64], false, 0], ["Get", "", [Go$String], [Object], false, 0], ["Index", "", [Go$Int], [Object], false, 0], ["Int", "", [], [Go$Int], false, 0], ["Interface", "", [], [go$emptyInterface], false, 0], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [Object], true, 0], ["IsNull", "", [], [Go$Bool], false, 0], ["IsUndefined", "", [], [Go$Bool], false, 0], ["Length", "", [], [Go$Int], false, 0], ["New", "", [(go$sliceType(go$emptyInterface))], [Object], true, 0], ["Set", "", [Go$String, go$emptyInterface], [], false, 0], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false, 0], ["String", "", [], [Go$String], false, 0]];
		Error.init([["Object", "", "", Object, ""]]);
	}
	return go$pkg;
})();
go$packages["github.com/gopherjs/jquery"] = (function() {
	var go$pkg = {}, js = go$packages["github.com/gopherjs/gopherjs/js"], JQuery, Event, JQueryCoordinates, NewJQuery, Now;
	JQuery = go$pkg.JQuery = go$newType(0, "Struct", "jquery.JQuery", "JQuery", "github.com/gopherjs/jquery", function(o_, Jquery_, Selector_, Length_, Context_) {
		this.go$val = this;
		this.o = o_ !== undefined ? o_ : null;
		this.Jquery = Jquery_ !== undefined ? Jquery_ : "";
		this.Selector = Selector_ !== undefined ? Selector_ : "";
		this.Length = Length_ !== undefined ? Length_ : "";
		this.Context = Context_ !== undefined ? Context_ : "";
	});
	Event = go$pkg.Event = go$newType(0, "Struct", "jquery.Event", "Event", "github.com/gopherjs/jquery", function(Object_, KeyCode_, Target_, CurrentTarget_, DelegateTarget_, RelatedTarget_, Data_, Result_, Which_, Namespace_, MetaKey_, PageX_, PageY_, Type_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
		this.KeyCode = KeyCode_ !== undefined ? KeyCode_ : 0;
		this.Target = Target_ !== undefined ? Target_ : null;
		this.CurrentTarget = CurrentTarget_ !== undefined ? CurrentTarget_ : null;
		this.DelegateTarget = DelegateTarget_ !== undefined ? DelegateTarget_ : null;
		this.RelatedTarget = RelatedTarget_ !== undefined ? RelatedTarget_ : null;
		this.Data = Data_ !== undefined ? Data_ : null;
		this.Result = Result_ !== undefined ? Result_ : null;
		this.Which = Which_ !== undefined ? Which_ : 0;
		this.Namespace = Namespace_ !== undefined ? Namespace_ : "";
		this.MetaKey = MetaKey_ !== undefined ? MetaKey_ : false;
		this.PageX = PageX_ !== undefined ? PageX_ : 0;
		this.PageY = PageY_ !== undefined ? PageY_ : 0;
		this.Type = Type_ !== undefined ? Type_ : "";
	});
	JQueryCoordinates = go$pkg.JQueryCoordinates = go$newType(0, "Struct", "jquery.JQueryCoordinates", "JQueryCoordinates", "github.com/gopherjs/jquery", function(Left_, Top_) {
		this.go$val = this;
		this.Left = Left_ !== undefined ? Left_ : 0;
		this.Top = Top_ !== undefined ? Top_ : 0;
	});
	Event.Ptr.prototype.PreventDefault = function() {
		var event;
		event = this;
		event.Object.preventDefault();
	};
	Event.prototype.PreventDefault = function() { return this.go$val.PreventDefault(); };
	Event.Ptr.prototype.IsDefaultPrevented = function() {
		var event;
		event = this;
		return !!(event.Object.isDefaultPrevented());
	};
	Event.prototype.IsDefaultPrevented = function() { return this.go$val.IsDefaultPrevented(); };
	Event.Ptr.prototype.IsImmediatePropogationStopped = function() {
		var event;
		event = this;
		return !!(event.Object.isImmediatePropogationStopped());
	};
	Event.prototype.IsImmediatePropogationStopped = function() { return this.go$val.IsImmediatePropogationStopped(); };
	Event.Ptr.prototype.IsPropagationStopped = function() {
		var event;
		event = this;
		return !!(event.Object.isPropagationStopped());
	};
	Event.prototype.IsPropagationStopped = function() { return this.go$val.IsPropagationStopped(); };
	Event.Ptr.prototype.StopImmediatePropagation = function() {
		var event;
		event = this;
		event.Object.stopImmediatePropagation();
	};
	Event.prototype.StopImmediatePropagation = function() { return this.go$val.StopImmediatePropagation(); };
	Event.Ptr.prototype.StopPropagation = function() {
		var event;
		event = this;
		event.Object.stopPropagation();
	};
	Event.prototype.StopPropagation = function() { return this.go$val.StopPropagation(); };
	NewJQuery = go$pkg.NewJQuery = function(args) {
		return new JQuery.Ptr(new (go$global.Function.prototype.bind.apply(go$global.jQuery, [undefined].concat(go$externalize(args, (go$sliceType(go$emptyInterface)))))), "", "", "", "");
	};
	Now = go$pkg.Now = function() {
		return go$parseFloat(go$global.jQuery.now());
	};
	JQuery.Ptr.prototype.Each = function(fn) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.each(go$externalize(fn, (go$funcType([Go$Int, go$emptyInterface], [go$emptyInterface], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Each = function(fn) { return this.go$val.Each(fn); };
	JQuery.Ptr.prototype.Underlying = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return j.o;
	};
	JQuery.prototype.Underlying = function() { return this.go$val.Underlying(); };
	JQuery.Ptr.prototype.Get = function(i) {
		var _struct, j, obj;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (obj = j.o, obj.get.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
	};
	JQuery.prototype.Get = function(i) { return this.go$val.Get(i); };
	JQuery.Ptr.prototype.Append = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom2args("append", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Append = function(i) { return this.go$val.Append(i); };
	JQuery.Ptr.prototype.Empty = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.empty();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Empty = function() { return this.go$val.Empty(); };
	JQuery.Ptr.prototype.Detach = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.detach.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Detach = function(i) { return this.go$val.Detach(i); };
	JQuery.Ptr.prototype.Serialize = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$internalize(j.o.serialize(), Go$String);
	};
	JQuery.prototype.Serialize = function() { return this.go$val.Serialize(); };
	JQuery.Ptr.prototype.SerializeArray = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return j.o.serializeArray();
	};
	JQuery.prototype.SerializeArray = function() { return this.go$val.SerializeArray(); };
	JQuery.Ptr.prototype.Eq = function(idx) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.eq(idx);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Eq = function(idx) { return this.go$val.Eq(idx); };
	JQuery.Ptr.prototype.FadeIn = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.fadeIn.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.FadeIn = function(i) { return this.go$val.FadeIn(i); };
	JQuery.Ptr.prototype.Delay = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.delay.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Delay = function(i) { return this.go$val.Delay(i); };
	JQuery.Ptr.prototype.ToArray = function() {
		var _struct, j, x;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (x = go$internalize(j.o.toArray(), go$emptyInterface), (x !== null && x.constructor === (go$sliceType(go$emptyInterface)) ? x.go$val : go$typeAssertionFailed(x, (go$sliceType(go$emptyInterface)))));
	};
	JQuery.prototype.ToArray = function() { return this.go$val.ToArray(); };
	JQuery.Ptr.prototype.Remove = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.remove.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Remove = function(i) { return this.go$val.Remove(i); };
	JQuery.Ptr.prototype.Stop = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.stop.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Stop = function(i) { return this.go$val.Stop(i); };
	JQuery.Ptr.prototype.AddBack = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.addBack.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.AddBack = function(i) { return this.go$val.AddBack(i); };
	JQuery.Ptr.prototype.Css = function(name) {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$internalize(j.o.css(go$externalize(name, Go$String)), Go$String);
	};
	JQuery.prototype.Css = function(name) { return this.go$val.Css(name); };
	JQuery.Ptr.prototype.CssArray = function(arr) {
		var _struct, j, x;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (x = go$internalize(j.o.css(go$externalize(arr, (go$sliceType(Go$String)))), go$emptyInterface), (x !== null && x.constructor === (go$mapType(Go$String, go$emptyInterface)) ? x.go$val : go$typeAssertionFailed(x, (go$mapType(Go$String, go$emptyInterface)))));
	};
	JQuery.prototype.CssArray = function(arr) { return this.go$val.CssArray(arr); };
	JQuery.Ptr.prototype.SetCss = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.css.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetCss = function(i) { return this.go$val.SetCss(i); };
	JQuery.Ptr.prototype.Text = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$internalize(j.o.text(), Go$String);
	};
	JQuery.prototype.Text = function() { return this.go$val.Text(); };
	JQuery.Ptr.prototype.SetText = function(i) {
		var _struct, j, _ref, _type, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		_ref = i;
		_type = _ref !== null ? _ref.constructor : null;
		if (_type === (go$funcType([Go$Int, Go$String], [Go$String], false)) || _type === Go$String) {
		} else {
			console.log("SetText Argument should be 'string' or 'func(int, string) string'");
		}
		j.o = j.o.text(go$externalize(i, go$emptyInterface));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetText = function(i) { return this.go$val.SetText(i); };
	JQuery.Ptr.prototype.Val = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$internalize(j.o.val(), Go$String);
	};
	JQuery.prototype.Val = function() { return this.go$val.Val(); };
	JQuery.Ptr.prototype.SetVal = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.val(go$externalize(i, go$emptyInterface));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetVal = function(i) { return this.go$val.SetVal(i); };
	JQuery.Ptr.prototype.Prop = function(property) {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$internalize(j.o.prop(go$externalize(property, Go$String)), go$emptyInterface);
	};
	JQuery.prototype.Prop = function(property) { return this.go$val.Prop(property); };
	JQuery.Ptr.prototype.SetProp = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.prop.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetProp = function(i) { return this.go$val.SetProp(i); };
	JQuery.Ptr.prototype.RemoveProp = function(property) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.removeProp(go$externalize(property, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.RemoveProp = function(property) { return this.go$val.RemoveProp(property); };
	JQuery.Ptr.prototype.Attr = function(property) {
		var _struct, j, attr;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		attr = j.o.attr(go$externalize(property, Go$String));
		if (attr === undefined) {
			return "";
		}
		return go$internalize(attr, Go$String);
	};
	JQuery.prototype.Attr = function(property) { return this.go$val.Attr(property); };
	JQuery.Ptr.prototype.SetAttr = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.attr.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetAttr = function(i) { return this.go$val.SetAttr(i); };
	JQuery.Ptr.prototype.RemoveAttr = function(property) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.removeAttr(go$externalize(property, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.RemoveAttr = function(property) { return this.go$val.RemoveAttr(property); };
	JQuery.Ptr.prototype.HasClass = function(class$1) {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return !!(j.o.hasClass(go$externalize(class$1, Go$String)));
	};
	JQuery.prototype.HasClass = function(class$1) { return this.go$val.HasClass(class$1); };
	JQuery.Ptr.prototype.AddClass = function(i) {
		var _struct, j, _ref, _type, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		_ref = i;
		_type = _ref !== null ? _ref.constructor : null;
		if (_type === (go$funcType([Go$Int, Go$String], [Go$String], false)) || _type === Go$String) {
		} else {
			console.log("addClass Argument should be 'string' or 'func(int, string) string'");
		}
		j.o = j.o.addClass(go$externalize(i, go$emptyInterface));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.AddClass = function(i) { return this.go$val.AddClass(i); };
	JQuery.Ptr.prototype.RemoveClass = function(property) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.removeClass(go$externalize(property, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.RemoveClass = function(property) { return this.go$val.RemoveClass(property); };
	JQuery.Ptr.prototype.ToggleClass = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.toggleClass.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.ToggleClass = function(i) { return this.go$val.ToggleClass(i); };
	JQuery.Ptr.prototype.Focus = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.focus();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Focus = function() { return this.go$val.Focus(); };
	JQuery.Ptr.prototype.Blur = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.blur();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Blur = function() { return this.go$val.Blur(); };
	JQuery.Ptr.prototype.ReplaceAll = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom1arg("replaceAll", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.ReplaceAll = function(i) { return this.go$val.ReplaceAll(i); };
	JQuery.Ptr.prototype.ReplaceWith = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom1arg("replaceWith", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.ReplaceWith = function(i) { return this.go$val.ReplaceWith(i); };
	JQuery.Ptr.prototype.After = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom2args("after", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.After = function(i) { return this.go$val.After(i); };
	JQuery.Ptr.prototype.Before = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom2args("before", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Before = function(i) { return this.go$val.Before(i); };
	JQuery.Ptr.prototype.Prepend = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom2args("prepend", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Prepend = function(i) { return this.go$val.Prepend(i); };
	JQuery.Ptr.prototype.PrependTo = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom1arg("prependTo", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.PrependTo = function(i) { return this.go$val.PrependTo(i); };
	JQuery.Ptr.prototype.AppendTo = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom1arg("appendTo", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.AppendTo = function(i) { return this.go$val.AppendTo(i); };
	JQuery.Ptr.prototype.InsertAfter = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom1arg("insertAfter", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.InsertAfter = function(i) { return this.go$val.InsertAfter(i); };
	JQuery.Ptr.prototype.InsertBefore = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom1arg("insertBefore", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.InsertBefore = function(i) { return this.go$val.InsertBefore(i); };
	JQuery.Ptr.prototype.Show = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.show();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Show = function() { return this.go$val.Show(); };
	JQuery.Ptr.prototype.Hide = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.hide();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Hide = function() { return this.go$val.Hide(); };
	JQuery.Ptr.prototype.Toggle = function(showOrHide) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.toggle(go$externalize(showOrHide, Go$Bool));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Toggle = function(showOrHide) { return this.go$val.Toggle(showOrHide); };
	JQuery.Ptr.prototype.Contents = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.contents();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Contents = function() { return this.go$val.Contents(); };
	JQuery.Ptr.prototype.Html = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$internalize(j.o.html(), Go$String);
	};
	JQuery.prototype.Html = function() { return this.go$val.Html(); };
	JQuery.Ptr.prototype.SetHtml = function(i) {
		var _struct, j, _ref, _type, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		_ref = i;
		_type = _ref !== null ? _ref.constructor : null;
		if (_type === (go$funcType([Go$Int, Go$String], [Go$String], false)) || _type === Go$String) {
		} else {
			console.log("SetHtml Argument should be 'string' or 'func(int, string) string'");
		}
		j.o = j.o.html(go$externalize(i, go$emptyInterface));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetHtml = function(i) { return this.go$val.SetHtml(i); };
	JQuery.Ptr.prototype.Closest = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom2args("closest", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Closest = function(i) { return this.go$val.Closest(i); };
	JQuery.Ptr.prototype.End = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.end();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.End = function() { return this.go$val.End(); };
	JQuery.Ptr.prototype.Add = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom2args("add", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Add = function(i) { return this.go$val.Add(i); };
	JQuery.Ptr.prototype.Clone = function(b) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.clone.apply(obj, go$externalize(b, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Clone = function(b) { return this.go$val.Clone(b); };
	JQuery.Ptr.prototype.Height = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$parseInt(j.o.height()) >> 0;
	};
	JQuery.prototype.Height = function() { return this.go$val.Height(); };
	JQuery.Ptr.prototype.SetHeight = function(value) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.height(go$externalize(value, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetHeight = function(value) { return this.go$val.SetHeight(value); };
	JQuery.Ptr.prototype.Width = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$parseInt(j.o.width()) >> 0;
	};
	JQuery.prototype.Width = function() { return this.go$val.Width(); };
	JQuery.Ptr.prototype.SetWidth = function(i) {
		var _struct, j, _ref, _type, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		_ref = i;
		_type = _ref !== null ? _ref.constructor : null;
		if (_type === (go$funcType([Go$Int, Go$String], [Go$String], false)) || _type === Go$String) {
		} else {
			console.log("SetWidth Argument should be 'string' or 'func(int, string) string'");
		}
		j.o = j.o.width(go$externalize(i, go$emptyInterface));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetWidth = function(i) { return this.go$val.SetWidth(i); };
	JQuery.Ptr.prototype.InnerHeight = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$parseInt(j.o.innerHeight()) >> 0;
	};
	JQuery.prototype.InnerHeight = function() { return this.go$val.InnerHeight(); };
	JQuery.Ptr.prototype.InnerWidth = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$parseInt(j.o.innerWidth()) >> 0;
	};
	JQuery.prototype.InnerWidth = function() { return this.go$val.InnerWidth(); };
	JQuery.Ptr.prototype.Offset = function() {
		var _struct, j, obj;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		obj = j.o.offset();
		return new JQueryCoordinates.Ptr(go$parseInt(obj.left) >> 0, go$parseInt(obj.top) >> 0);
	};
	JQuery.prototype.Offset = function() { return this.go$val.Offset(); };
	JQuery.Ptr.prototype.SetOffset = function(jc) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.offset(go$externalize(jc, JQueryCoordinates));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetOffset = function(jc) { return this.go$val.SetOffset(jc); };
	JQuery.Ptr.prototype.OuterHeight = function(includeMargin) {
		var _struct, j, _slice, _index;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		if (includeMargin.length === 0) {
			return go$parseInt(j.o.outerHeight()) >> 0;
		}
		return go$parseInt(j.o.outerHeight(go$externalize((_slice = includeMargin, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")), Go$Bool))) >> 0;
	};
	JQuery.prototype.OuterHeight = function(includeMargin) { return this.go$val.OuterHeight(includeMargin); };
	JQuery.Ptr.prototype.OuterWidth = function(includeMargin) {
		var _struct, j, _slice, _index;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		if (includeMargin.length === 0) {
			return go$parseInt(j.o.outerWidth()) >> 0;
		}
		return go$parseInt(j.o.outerWidth(go$externalize((_slice = includeMargin, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")), Go$Bool))) >> 0;
	};
	JQuery.prototype.OuterWidth = function(includeMargin) { return this.go$val.OuterWidth(includeMargin); };
	JQuery.Ptr.prototype.Position = function() {
		var _struct, j, obj;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		obj = j.o.position();
		return new JQueryCoordinates.Ptr(go$parseInt(obj.left) >> 0, go$parseInt(obj.top) >> 0);
	};
	JQuery.prototype.Position = function() { return this.go$val.Position(); };
	JQuery.Ptr.prototype.ScrollLeft = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$parseInt(j.o.scrollLeft()) >> 0;
	};
	JQuery.prototype.ScrollLeft = function() { return this.go$val.ScrollLeft(); };
	JQuery.Ptr.prototype.SetScrollLeft = function(value) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.scrollLeft(value);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetScrollLeft = function(value) { return this.go$val.SetScrollLeft(value); };
	JQuery.Ptr.prototype.ScrollTop = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$parseInt(j.o.scrollTop()) >> 0;
	};
	JQuery.prototype.ScrollTop = function() { return this.go$val.ScrollTop(); };
	JQuery.Ptr.prototype.SetScrollTop = function(value) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.scrollTop(value);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetScrollTop = function(value) { return this.go$val.SetScrollTop(value); };
	JQuery.Ptr.prototype.ClearQueue = function(queueName) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.clearQueue(go$externalize(queueName, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.ClearQueue = function(queueName) { return this.go$val.ClearQueue(queueName); };
	JQuery.Ptr.prototype.SetData = function(key, value) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.data(go$externalize(key, Go$String), go$externalize(value, go$emptyInterface));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetData = function(key, value) { return this.go$val.SetData(key, value); };
	JQuery.Ptr.prototype.Data = function(key) {
		var _struct, j, result;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		result = j.o.data(go$externalize(key, Go$String));
		if (result === undefined) {
			return null;
		}
		return go$internalize(result, go$emptyInterface);
	};
	JQuery.prototype.Data = function(key) { return this.go$val.Data(key); };
	JQuery.Ptr.prototype.Dequeue = function(queueName) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.dequeue(go$externalize(queueName, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Dequeue = function(queueName) { return this.go$val.Dequeue(queueName); };
	JQuery.Ptr.prototype.RemoveData = function(name) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.removeData(go$externalize(name, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.RemoveData = function(name) { return this.go$val.RemoveData(name); };
	JQuery.Ptr.prototype.OffsetParent = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.offsetParent();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.OffsetParent = function() { return this.go$val.OffsetParent(); };
	JQuery.Ptr.prototype.Parent = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.parent.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Parent = function(i) { return this.go$val.Parent(i); };
	JQuery.Ptr.prototype.Parents = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.parents.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Parents = function(i) { return this.go$val.Parents(i); };
	JQuery.Ptr.prototype.ParentsUntil = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.parentsUntil.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.ParentsUntil = function(i) { return this.go$val.ParentsUntil(i); };
	JQuery.Ptr.prototype.Prev = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.prev.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Prev = function(i) { return this.go$val.Prev(i); };
	JQuery.Ptr.prototype.PrevAll = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.prevAll.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.PrevAll = function(i) { return this.go$val.PrevAll(i); };
	JQuery.Ptr.prototype.PrevUntil = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.prevUntil.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.PrevUntil = function(i) { return this.go$val.PrevUntil(i); };
	JQuery.Ptr.prototype.Siblings = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.siblings.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Siblings = function(i) { return this.go$val.Siblings(i); };
	JQuery.Ptr.prototype.Slice = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.slice.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Slice = function(i) { return this.go$val.Slice(i); };
	JQuery.Ptr.prototype.Children = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.children(go$externalize(selector, go$emptyInterface));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Children = function(selector) { return this.go$val.Children(selector); };
	JQuery.Ptr.prototype.Unwrap = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.unwrap();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Unwrap = function() { return this.go$val.Unwrap(); };
	JQuery.Ptr.prototype.Wrap = function(obj) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.wrap(go$externalize(obj, go$emptyInterface));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Wrap = function(obj) { return this.go$val.Wrap(obj); };
	JQuery.Ptr.prototype.WrapAll = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom1arg("wrapAll", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.WrapAll = function(i) { return this.go$val.WrapAll(i); };
	JQuery.Ptr.prototype.WrapInner = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom1arg("wrapInner", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.WrapInner = function(i) { return this.go$val.WrapInner(i); };
	JQuery.Ptr.prototype.Next = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.next.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Next = function(i) { return this.go$val.Next(i); };
	JQuery.Ptr.prototype.NextAll = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.nextAll.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.NextAll = function(i) { return this.go$val.NextAll(i); };
	JQuery.Ptr.prototype.NextUntil = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.nextUntil.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.NextUntil = function(i) { return this.go$val.NextUntil(i); };
	JQuery.Ptr.prototype.Not = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.not.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Not = function(i) { return this.go$val.Not(i); };
	JQuery.Ptr.prototype.Filter = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.filter.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Filter = function(i) { return this.go$val.Filter(i); };
	JQuery.Ptr.prototype.Find = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.find.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Find = function(i) { return this.go$val.Find(i); };
	JQuery.Ptr.prototype.First = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.first();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.First = function() { return this.go$val.First(); };
	JQuery.Ptr.prototype.Has = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.has(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Has = function(selector) { return this.go$val.Has(selector); };
	JQuery.Ptr.prototype.Is = function(i) {
		var _struct, j, obj;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return !!((obj = j.o, obj.is.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface))))));
	};
	JQuery.prototype.Is = function(i) { return this.go$val.Is(i); };
	JQuery.Ptr.prototype.Last = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.last();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Last = function() { return this.go$val.Last(); };
	JQuery.Ptr.prototype.Ready = function(handler) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.ready(go$externalize(handler, (go$funcType([], [], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Ready = function(handler) { return this.go$val.Ready(handler); };
	JQuery.Ptr.prototype.Resize = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.resize.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Resize = function(i) { return this.go$val.Resize(i); };
	JQuery.Ptr.prototype.Scroll = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.handleEvent("scroll", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Scroll = function(i) { return this.go$val.Scroll(i); };
	JQuery.Ptr.prototype.FadeOut = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.fadeOut.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.FadeOut = function(i) { return this.go$val.FadeOut(i); };
	JQuery.Ptr.prototype.Select = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.handleEvent("select", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Select = function(i) { return this.go$val.Select(i); };
	JQuery.Ptr.prototype.Submit = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.handleEvent("submit", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Submit = function(i) { return this.go$val.Submit(i); };
	JQuery.Ptr.prototype.handleEvent = function(evt, i) {
		var _struct, j, _ref, x, _slice, _index, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		_ref = i.length;
		if (_ref === 0) {
			j.o = j.o[go$externalize(evt, Go$String)]();
		} else if (_ref === 1) {
			j.o = j.o[go$externalize(evt, Go$String)](go$externalize((function(e) {
				var x, _slice, _index;
				(x = (_slice = i, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")), (x !== null && x.constructor === (go$funcType([Event], [], false)) ? x.go$val : go$typeAssertionFailed(x, (go$funcType([Event], [], false)))))(new Event.Ptr(e, 0, null, null, null, null, null, null, 0, "", false, 0, 0, ""));
			}), (go$funcType([js.Object], [], false))));
		} else if (_ref === 2) {
			j.o = j.o[go$externalize(evt, Go$String)](go$externalize((x = (_slice = i, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")), (x !== null && x.constructor === (go$mapType(Go$String, go$emptyInterface)) ? x.go$val : go$typeAssertionFailed(x, (go$mapType(Go$String, go$emptyInterface))))), (go$mapType(Go$String, go$emptyInterface))), go$externalize((function(e) {
				var x$1, _slice$1, _index$1;
				(x$1 = (_slice$1 = i, _index$1 = 1, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")), (x$1 !== null && x$1.constructor === (go$funcType([Event], [], false)) ? x$1.go$val : go$typeAssertionFailed(x$1, (go$funcType([Event], [], false)))))(new Event.Ptr(e, 0, null, null, null, null, null, null, 0, "", false, 0, 0, ""));
			}), (go$funcType([js.Object], [], false))));
		} else {
			console.log(evt + " event expects 0 to 2 arguments");
		}
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.handleEvent = function(evt, i) { return this.go$val.handleEvent(evt, i); };
	JQuery.Ptr.prototype.Trigger = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.trigger.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Trigger = function(i) { return this.go$val.Trigger(i); };
	JQuery.Ptr.prototype.On = function(p) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.events("on", p), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.On = function(p) { return this.go$val.On(p); };
	JQuery.Ptr.prototype.One = function(p) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.events("one", p), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.One = function(p) { return this.go$val.One(p); };
	JQuery.Ptr.prototype.Off = function(p) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.events("off", p), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Off = function(p) { return this.go$val.Off(p); };
	JQuery.Ptr.prototype.events = function(evt, p) {
		var _struct, j, count, isEventFunc, _ref, _type, _slice, _index, _ref$1, _struct$1, _slice$1, _index$1, _struct$2, _slice$2, _index$2, _struct$3, _slice$3, _index$3, _slice$4, _index$4, _struct$4, _slice$5, _index$5, _slice$6, _index$6, _struct$5, _slice$7, _index$7, _slice$8, _index$8, _slice$9, _index$9, _struct$6, _slice$10, _index$10, _slice$11, _index$11, _slice$12, _index$12, _struct$7, _slice$13, _index$13, _slice$14, _index$14, _slice$15, _index$15, _slice$16, _index$16, _struct$8, obj, _struct$9;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		count = p.length;
		isEventFunc = false;
		_ref = (_slice = p, _index = (p.length - 1 >> 0), (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range"));
		_type = _ref !== null ? _ref.constructor : null;
		if (_type === (go$funcType([Event], [], false))) {
			isEventFunc = true;
		} else {
			isEventFunc = false;
		}
		_ref$1 = count;
		if (_ref$1 === 0) {
			j.o = j.o[go$externalize(evt, Go$String)]();
			return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
		} else if (_ref$1 === 1) {
			j.o = j.o[go$externalize(evt, Go$String)](go$externalize((_slice$1 = p, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")), go$emptyInterface));
			return (_struct$2 = j, new JQuery.Ptr(_struct$2.o, _struct$2.Jquery, _struct$2.Selector, _struct$2.Length, _struct$2.Context));
		} else if (_ref$1 === 2) {
			if (isEventFunc) {
				j.o = j.o[go$externalize(evt, Go$String)](go$externalize((_slice$2 = p, _index$2 = 0, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((function(e) {
					var x, _slice$3, _index$3;
					(x = (_slice$3 = p, _index$3 = 1, (_index$3 >= 0 && _index$3 < _slice$3.length) ? _slice$3.array[_slice$3.offset + _index$3] : go$throwRuntimeError("index out of range")), (x !== null && x.constructor === (go$funcType([Event], [], false)) ? x.go$val : go$typeAssertionFailed(x, (go$funcType([Event], [], false)))))(new Event.Ptr(e, 0, null, null, null, null, null, null, 0, "", false, 0, 0, ""));
				}), (go$funcType([js.Object], [], false))));
				return (_struct$3 = j, new JQuery.Ptr(_struct$3.o, _struct$3.Jquery, _struct$3.Selector, _struct$3.Length, _struct$3.Context));
			} else {
				j.o = j.o[go$externalize(evt, Go$String)](go$externalize((_slice$3 = p, _index$3 = 0, (_index$3 >= 0 && _index$3 < _slice$3.length) ? _slice$3.array[_slice$3.offset + _index$3] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((_slice$4 = p, _index$4 = 1, (_index$4 >= 0 && _index$4 < _slice$4.length) ? _slice$4.array[_slice$4.offset + _index$4] : go$throwRuntimeError("index out of range")), go$emptyInterface));
				return (_struct$4 = j, new JQuery.Ptr(_struct$4.o, _struct$4.Jquery, _struct$4.Selector, _struct$4.Length, _struct$4.Context));
			}
		} else if (_ref$1 === 3) {
			if (isEventFunc) {
				j.o = j.o[go$externalize(evt, Go$String)](go$externalize((_slice$5 = p, _index$5 = 0, (_index$5 >= 0 && _index$5 < _slice$5.length) ? _slice$5.array[_slice$5.offset + _index$5] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((_slice$6 = p, _index$6 = 1, (_index$6 >= 0 && _index$6 < _slice$6.length) ? _slice$6.array[_slice$6.offset + _index$6] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((function(e) {
					var x, _slice$7, _index$7;
					(x = (_slice$7 = p, _index$7 = 2, (_index$7 >= 0 && _index$7 < _slice$7.length) ? _slice$7.array[_slice$7.offset + _index$7] : go$throwRuntimeError("index out of range")), (x !== null && x.constructor === (go$funcType([Event], [], false)) ? x.go$val : go$typeAssertionFailed(x, (go$funcType([Event], [], false)))))(new Event.Ptr(e, 0, null, null, null, null, null, null, 0, "", false, 0, 0, ""));
				}), (go$funcType([js.Object], [], false))));
				return (_struct$5 = j, new JQuery.Ptr(_struct$5.o, _struct$5.Jquery, _struct$5.Selector, _struct$5.Length, _struct$5.Context));
			} else {
				j.o = j.o[go$externalize(evt, Go$String)](go$externalize((_slice$7 = p, _index$7 = 0, (_index$7 >= 0 && _index$7 < _slice$7.length) ? _slice$7.array[_slice$7.offset + _index$7] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((_slice$8 = p, _index$8 = 1, (_index$8 >= 0 && _index$8 < _slice$8.length) ? _slice$8.array[_slice$8.offset + _index$8] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((_slice$9 = p, _index$9 = 2, (_index$9 >= 0 && _index$9 < _slice$9.length) ? _slice$9.array[_slice$9.offset + _index$9] : go$throwRuntimeError("index out of range")), go$emptyInterface));
				return (_struct$6 = j, new JQuery.Ptr(_struct$6.o, _struct$6.Jquery, _struct$6.Selector, _struct$6.Length, _struct$6.Context));
			}
		} else if (_ref$1 === 4) {
			if (isEventFunc) {
				j.o = j.o[go$externalize(evt, Go$String)](go$externalize((_slice$10 = p, _index$10 = 0, (_index$10 >= 0 && _index$10 < _slice$10.length) ? _slice$10.array[_slice$10.offset + _index$10] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((_slice$11 = p, _index$11 = 1, (_index$11 >= 0 && _index$11 < _slice$11.length) ? _slice$11.array[_slice$11.offset + _index$11] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((_slice$12 = p, _index$12 = 2, (_index$12 >= 0 && _index$12 < _slice$12.length) ? _slice$12.array[_slice$12.offset + _index$12] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((function(e) {
					var x, _slice$13, _index$13;
					(x = (_slice$13 = p, _index$13 = 3, (_index$13 >= 0 && _index$13 < _slice$13.length) ? _slice$13.array[_slice$13.offset + _index$13] : go$throwRuntimeError("index out of range")), (x !== null && x.constructor === (go$funcType([Event], [], false)) ? x.go$val : go$typeAssertionFailed(x, (go$funcType([Event], [], false)))))(new Event.Ptr(e, 0, null, null, null, null, null, null, 0, "", false, 0, 0, ""));
				}), (go$funcType([js.Object], [], false))));
				return (_struct$7 = j, new JQuery.Ptr(_struct$7.o, _struct$7.Jquery, _struct$7.Selector, _struct$7.Length, _struct$7.Context));
			} else {
				j.o = j.o[go$externalize(evt, Go$String)](go$externalize((_slice$13 = p, _index$13 = 0, (_index$13 >= 0 && _index$13 < _slice$13.length) ? _slice$13.array[_slice$13.offset + _index$13] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((_slice$14 = p, _index$14 = 1, (_index$14 >= 0 && _index$14 < _slice$14.length) ? _slice$14.array[_slice$14.offset + _index$14] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((_slice$15 = p, _index$15 = 2, (_index$15 >= 0 && _index$15 < _slice$15.length) ? _slice$15.array[_slice$15.offset + _index$15] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((_slice$16 = p, _index$16 = 3, (_index$16 >= 0 && _index$16 < _slice$16.length) ? _slice$16.array[_slice$16.offset + _index$16] : go$throwRuntimeError("index out of range")), go$emptyInterface));
				return (_struct$8 = j, new JQuery.Ptr(_struct$8.o, _struct$8.Jquery, _struct$8.Selector, _struct$8.Length, _struct$8.Context));
			}
		} else {
			console.log(evt + " event should no have more than 4 arguments");
			j.o = (obj = j.o, obj[go$externalize(evt, Go$String)].apply(obj, go$externalize(p, (go$sliceType(go$emptyInterface)))));
			return (_struct$9 = j, new JQuery.Ptr(_struct$9.o, _struct$9.Jquery, _struct$9.Selector, _struct$9.Length, _struct$9.Context));
		}
	};
	JQuery.prototype.events = function(evt, p) { return this.go$val.events(evt, p); };
	JQuery.Ptr.prototype.dom2args = function(method, i) {
		var _struct, j, _ref, _tuple, x, _slice, _index, _struct$1, selector, selOk, _tuple$1, x$1, _slice$1, _index$1, _struct$2, context, ctxOk, _slice$2, _index$2, _slice$3, _index$3, _struct$3, _slice$4, _index$4, _struct$4, _slice$5, _index$5, _struct$5, _struct$6, _tuple$2, x$2, _slice$6, _index$6, _struct$7, selector$1, selOk$1, _slice$7, _index$7, _struct$8, _struct$9, _struct$10;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		_ref = i.length;
		if (_ref === 2) {
			_tuple = (x = (_slice = i, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")), (x !== null && x.constructor === JQuery ? [x.go$val, true] : [new JQuery.Ptr(), false])), selector = (_struct$1 = _tuple[0], new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context)), selOk = _tuple[1];
			_tuple$1 = (x$1 = (_slice$1 = i, _index$1 = 1, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")), (x$1 !== null && x$1.constructor === JQuery ? [x$1.go$val, true] : [new JQuery.Ptr(), false])), context = (_struct$2 = _tuple$1[0], new JQuery.Ptr(_struct$2.o, _struct$2.Jquery, _struct$2.Selector, _struct$2.Length, _struct$2.Context)), ctxOk = _tuple$1[1];
			if (!selOk && !ctxOk) {
				j.o = j.o[go$externalize(method, Go$String)](go$externalize((_slice$2 = i, _index$2 = 0, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((_slice$3 = i, _index$3 = 1, (_index$3 >= 0 && _index$3 < _slice$3.length) ? _slice$3.array[_slice$3.offset + _index$3] : go$throwRuntimeError("index out of range")), go$emptyInterface));
				return (_struct$3 = j, new JQuery.Ptr(_struct$3.o, _struct$3.Jquery, _struct$3.Selector, _struct$3.Length, _struct$3.Context));
			} else if (selOk && !ctxOk) {
				j.o = j.o[go$externalize(method, Go$String)](selector.o, go$externalize((_slice$4 = i, _index$4 = 1, (_index$4 >= 0 && _index$4 < _slice$4.length) ? _slice$4.array[_slice$4.offset + _index$4] : go$throwRuntimeError("index out of range")), go$emptyInterface));
				return (_struct$4 = j, new JQuery.Ptr(_struct$4.o, _struct$4.Jquery, _struct$4.Selector, _struct$4.Length, _struct$4.Context));
			} else if (!selOk && ctxOk) {
				j.o = j.o[go$externalize(method, Go$String)](go$externalize((_slice$5 = i, _index$5 = 0, (_index$5 >= 0 && _index$5 < _slice$5.length) ? _slice$5.array[_slice$5.offset + _index$5] : go$throwRuntimeError("index out of range")), go$emptyInterface), context.o);
				return (_struct$5 = j, new JQuery.Ptr(_struct$5.o, _struct$5.Jquery, _struct$5.Selector, _struct$5.Length, _struct$5.Context));
			}
			j.o = j.o[go$externalize(method, Go$String)](selector.o, context.o);
			return (_struct$6 = j, new JQuery.Ptr(_struct$6.o, _struct$6.Jquery, _struct$6.Selector, _struct$6.Length, _struct$6.Context));
		} else if (_ref === 1) {
			_tuple$2 = (x$2 = (_slice$6 = i, _index$6 = 0, (_index$6 >= 0 && _index$6 < _slice$6.length) ? _slice$6.array[_slice$6.offset + _index$6] : go$throwRuntimeError("index out of range")), (x$2 !== null && x$2.constructor === JQuery ? [x$2.go$val, true] : [new JQuery.Ptr(), false])), selector$1 = (_struct$7 = _tuple$2[0], new JQuery.Ptr(_struct$7.o, _struct$7.Jquery, _struct$7.Selector, _struct$7.Length, _struct$7.Context)), selOk$1 = _tuple$2[1];
			if (!selOk$1) {
				j.o = j.o[go$externalize(method, Go$String)](go$externalize((_slice$7 = i, _index$7 = 0, (_index$7 >= 0 && _index$7 < _slice$7.length) ? _slice$7.array[_slice$7.offset + _index$7] : go$throwRuntimeError("index out of range")), go$emptyInterface));
				return (_struct$8 = j, new JQuery.Ptr(_struct$8.o, _struct$8.Jquery, _struct$8.Selector, _struct$8.Length, _struct$8.Context));
			}
			j.o = j.o[go$externalize(method, Go$String)](selector$1.o);
			return (_struct$9 = j, new JQuery.Ptr(_struct$9.o, _struct$9.Jquery, _struct$9.Selector, _struct$9.Length, _struct$9.Context));
		} else {
			console.log(" only 1 or 2 parameters allowed for method ", method);
			return (_struct$10 = j, new JQuery.Ptr(_struct$10.o, _struct$10.Jquery, _struct$10.Selector, _struct$10.Length, _struct$10.Context));
		}
	};
	JQuery.prototype.dom2args = function(method, i) { return this.go$val.dom2args(method, i); };
	JQuery.Ptr.prototype.dom1arg = function(method, i) {
		var _struct, j, _tuple, _struct$1, selector, selOk, _struct$2, _struct$3;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		_tuple = (i !== null && i.constructor === JQuery ? [i.go$val, true] : [new JQuery.Ptr(), false]), selector = (_struct$1 = _tuple[0], new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context)), selOk = _tuple[1];
		if (!selOk) {
			j.o = j.o[go$externalize(method, Go$String)](go$externalize(i, go$emptyInterface));
			return (_struct$2 = j, new JQuery.Ptr(_struct$2.o, _struct$2.Jquery, _struct$2.Selector, _struct$2.Length, _struct$2.Context));
		}
		j.o = j.o[go$externalize(method, Go$String)](selector.o);
		return (_struct$3 = j, new JQuery.Ptr(_struct$3.o, _struct$3.Jquery, _struct$3.Selector, _struct$3.Length, _struct$3.Context));
	};
	JQuery.prototype.dom1arg = function(method, i) { return this.go$val.dom1arg(method, i); };
	go$pkg.init = function() {
		JQuery.methods = [["Add", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["AddBack", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["AddClass", "", [go$emptyInterface], [JQuery], false, -1], ["After", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Append", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["AppendTo", "", [go$emptyInterface], [JQuery], false, -1], ["Attr", "", [Go$String], [Go$String], false, -1], ["Before", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Blur", "", [], [JQuery], false, -1], ["Children", "", [go$emptyInterface], [JQuery], false, -1], ["ClearQueue", "", [Go$String], [JQuery], false, -1], ["Clone", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Closest", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Contents", "", [], [JQuery], false, -1], ["Css", "", [Go$String], [Go$String], false, -1], ["CssArray", "", [(go$sliceType(Go$String))], [(go$mapType(Go$String, go$emptyInterface))], true, -1], ["Data", "", [Go$String], [go$emptyInterface], false, -1], ["Delay", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Dequeue", "", [Go$String], [JQuery], false, -1], ["Detach", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Each", "", [(go$funcType([Go$Int, go$emptyInterface], [go$emptyInterface], false))], [JQuery], false, -1], ["Empty", "", [], [JQuery], false, -1], ["End", "", [], [JQuery], false, -1], ["Eq", "", [Go$Int], [JQuery], false, -1], ["FadeIn", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["FadeOut", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Filter", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Find", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["First", "", [], [JQuery], false, -1], ["Focus", "", [], [JQuery], false, -1], ["Get", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, -1], ["Has", "", [Go$String], [JQuery], false, -1], ["HasClass", "", [Go$String], [Go$Bool], false, -1], ["Height", "", [], [Go$Int], false, -1], ["Hide", "", [], [JQuery], false, -1], ["Html", "", [], [Go$String], false, -1], ["InnerHeight", "", [], [Go$Int], false, -1], ["InnerWidth", "", [], [Go$Int], false, -1], ["InsertAfter", "", [go$emptyInterface], [JQuery], false, -1], ["InsertBefore", "", [go$emptyInterface], [JQuery], false, -1], ["Is", "", [(go$sliceType(go$emptyInterface))], [Go$Bool], true, -1], ["Last", "", [], [JQuery], false, -1], ["Next", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["NextAll", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["NextUntil", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Not", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Off", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Offset", "", [], [JQueryCoordinates], false, -1], ["OffsetParent", "", [], [JQuery], false, -1], ["On", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["One", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["OuterHeight", "", [(go$sliceType(Go$Bool))], [Go$Int], true, -1], ["OuterWidth", "", [(go$sliceType(Go$Bool))], [Go$Int], true, -1], ["Parent", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Parents", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["ParentsUntil", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Position", "", [], [JQueryCoordinates], false, -1], ["Prepend", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["PrependTo", "", [go$emptyInterface], [JQuery], false, -1], ["Prev", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["PrevAll", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["PrevUntil", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Prop", "", [Go$String], [go$emptyInterface], false, -1], ["Ready", "", [(go$funcType([], [], false))], [JQuery], false, -1], ["Remove", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["RemoveAttr", "", [Go$String], [JQuery], false, -1], ["RemoveClass", "", [Go$String], [JQuery], false, -1], ["RemoveData", "", [Go$String], [JQuery], false, -1], ["RemoveProp", "", [Go$String], [JQuery], false, -1], ["ReplaceAll", "", [go$emptyInterface], [JQuery], false, -1], ["ReplaceWith", "", [go$emptyInterface], [JQuery], false, -1], ["Resize", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Scroll", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["ScrollLeft", "", [], [Go$Int], false, -1], ["ScrollTop", "", [], [Go$Int], false, -1], ["Select", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Serialize", "", [], [Go$String], false, -1], ["SerializeArray", "", [], [js.Object], false, -1], ["SetAttr", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["SetCss", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["SetData", "", [Go$String, go$emptyInterface], [JQuery], false, -1], ["SetHeight", "", [Go$String], [JQuery], false, -1], ["SetHtml", "", [go$emptyInterface], [JQuery], false, -1], ["SetOffset", "", [JQueryCoordinates], [JQuery], false, -1], ["SetProp", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["SetScrollLeft", "", [Go$Int], [JQuery], false, -1], ["SetScrollTop", "", [Go$Int], [JQuery], false, -1], ["SetText", "", [go$emptyInterface], [JQuery], false, -1], ["SetVal", "", [go$emptyInterface], [JQuery], false, -1], ["SetWidth", "", [go$emptyInterface], [JQuery], false, -1], ["Show", "", [], [JQuery], false, -1], ["Siblings", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Slice", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Stop", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Submit", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Text", "", [], [Go$String], false, -1], ["ToArray", "", [], [(go$sliceType(go$emptyInterface))], false, -1], ["Toggle", "", [Go$Bool], [JQuery], false, -1], ["ToggleClass", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Trigger", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Underlying", "", [], [js.Object], false, -1], ["Unwrap", "", [], [JQuery], false, -1], ["Val", "", [], [Go$String], false, -1], ["Width", "", [], [Go$Int], false, -1], ["Wrap", "", [go$emptyInterface], [JQuery], false, -1], ["WrapAll", "", [go$emptyInterface], [JQuery], false, -1], ["WrapInner", "", [go$emptyInterface], [JQuery], false, -1], ["dom1arg", "github.com/gopherjs/jquery", [Go$String, go$emptyInterface], [JQuery], false, -1], ["dom2args", "github.com/gopherjs/jquery", [Go$String, (go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["events", "github.com/gopherjs/jquery", [Go$String, (go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["handleEvent", "github.com/gopherjs/jquery", [Go$String, (go$sliceType(go$emptyInterface))], [JQuery], true, -1]];
		(go$ptrType(JQuery)).methods = [["Add", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["AddBack", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["AddClass", "", [go$emptyInterface], [JQuery], false, -1], ["After", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Append", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["AppendTo", "", [go$emptyInterface], [JQuery], false, -1], ["Attr", "", [Go$String], [Go$String], false, -1], ["Before", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Blur", "", [], [JQuery], false, -1], ["Children", "", [go$emptyInterface], [JQuery], false, -1], ["ClearQueue", "", [Go$String], [JQuery], false, -1], ["Clone", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Closest", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Contents", "", [], [JQuery], false, -1], ["Css", "", [Go$String], [Go$String], false, -1], ["CssArray", "", [(go$sliceType(Go$String))], [(go$mapType(Go$String, go$emptyInterface))], true, -1], ["Data", "", [Go$String], [go$emptyInterface], false, -1], ["Delay", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Dequeue", "", [Go$String], [JQuery], false, -1], ["Detach", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Each", "", [(go$funcType([Go$Int, go$emptyInterface], [go$emptyInterface], false))], [JQuery], false, -1], ["Empty", "", [], [JQuery], false, -1], ["End", "", [], [JQuery], false, -1], ["Eq", "", [Go$Int], [JQuery], false, -1], ["FadeIn", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["FadeOut", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Filter", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Find", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["First", "", [], [JQuery], false, -1], ["Focus", "", [], [JQuery], false, -1], ["Get", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, -1], ["Has", "", [Go$String], [JQuery], false, -1], ["HasClass", "", [Go$String], [Go$Bool], false, -1], ["Height", "", [], [Go$Int], false, -1], ["Hide", "", [], [JQuery], false, -1], ["Html", "", [], [Go$String], false, -1], ["InnerHeight", "", [], [Go$Int], false, -1], ["InnerWidth", "", [], [Go$Int], false, -1], ["InsertAfter", "", [go$emptyInterface], [JQuery], false, -1], ["InsertBefore", "", [go$emptyInterface], [JQuery], false, -1], ["Is", "", [(go$sliceType(go$emptyInterface))], [Go$Bool], true, -1], ["Last", "", [], [JQuery], false, -1], ["Next", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["NextAll", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["NextUntil", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Not", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Off", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Offset", "", [], [JQueryCoordinates], false, -1], ["OffsetParent", "", [], [JQuery], false, -1], ["On", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["One", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["OuterHeight", "", [(go$sliceType(Go$Bool))], [Go$Int], true, -1], ["OuterWidth", "", [(go$sliceType(Go$Bool))], [Go$Int], true, -1], ["Parent", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Parents", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["ParentsUntil", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Position", "", [], [JQueryCoordinates], false, -1], ["Prepend", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["PrependTo", "", [go$emptyInterface], [JQuery], false, -1], ["Prev", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["PrevAll", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["PrevUntil", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Prop", "", [Go$String], [go$emptyInterface], false, -1], ["Ready", "", [(go$funcType([], [], false))], [JQuery], false, -1], ["Remove", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["RemoveAttr", "", [Go$String], [JQuery], false, -1], ["RemoveClass", "", [Go$String], [JQuery], false, -1], ["RemoveData", "", [Go$String], [JQuery], false, -1], ["RemoveProp", "", [Go$String], [JQuery], false, -1], ["ReplaceAll", "", [go$emptyInterface], [JQuery], false, -1], ["ReplaceWith", "", [go$emptyInterface], [JQuery], false, -1], ["Resize", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Scroll", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["ScrollLeft", "", [], [Go$Int], false, -1], ["ScrollTop", "", [], [Go$Int], false, -1], ["Select", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Serialize", "", [], [Go$String], false, -1], ["SerializeArray", "", [], [js.Object], false, -1], ["SetAttr", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["SetCss", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["SetData", "", [Go$String, go$emptyInterface], [JQuery], false, -1], ["SetHeight", "", [Go$String], [JQuery], false, -1], ["SetHtml", "", [go$emptyInterface], [JQuery], false, -1], ["SetOffset", "", [JQueryCoordinates], [JQuery], false, -1], ["SetProp", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["SetScrollLeft", "", [Go$Int], [JQuery], false, -1], ["SetScrollTop", "", [Go$Int], [JQuery], false, -1], ["SetText", "", [go$emptyInterface], [JQuery], false, -1], ["SetVal", "", [go$emptyInterface], [JQuery], false, -1], ["SetWidth", "", [go$emptyInterface], [JQuery], false, -1], ["Show", "", [], [JQuery], false, -1], ["Siblings", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Slice", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Stop", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Submit", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Text", "", [], [Go$String], false, -1], ["ToArray", "", [], [(go$sliceType(go$emptyInterface))], false, -1], ["Toggle", "", [Go$Bool], [JQuery], false, -1], ["ToggleClass", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Trigger", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Underlying", "", [], [js.Object], false, -1], ["Unwrap", "", [], [JQuery], false, -1], ["Val", "", [], [Go$String], false, -1], ["Width", "", [], [Go$Int], false, -1], ["Wrap", "", [go$emptyInterface], [JQuery], false, -1], ["WrapAll", "", [go$emptyInterface], [JQuery], false, -1], ["WrapInner", "", [go$emptyInterface], [JQuery], false, -1], ["dom1arg", "github.com/gopherjs/jquery", [Go$String, go$emptyInterface], [JQuery], false, -1], ["dom2args", "github.com/gopherjs/jquery", [Go$String, (go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["events", "github.com/gopherjs/jquery", [Go$String, (go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["handleEvent", "github.com/gopherjs/jquery", [Go$String, (go$sliceType(go$emptyInterface))], [JQuery], true, -1]];
		JQuery.init([["o", "o", "github.com/gopherjs/jquery", js.Object, ""], ["Jquery", "Jquery", "", Go$String, "js:\"jquery\""], ["Selector", "Selector", "", Go$String, "js:\"selector\""], ["Length", "Length", "", Go$String, "js:\"length\""], ["Context", "Context", "", Go$String, "js:\"context\""]]);
		Event.methods = [["Bool", "", [], [Go$Bool], false, 0], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["Float", "", [], [Go$Float64], false, 0], ["Get", "", [Go$String], [js.Object], false, 0], ["Index", "", [Go$Int], [js.Object], false, 0], ["Int", "", [], [Go$Int], false, 0], ["Interface", "", [], [go$emptyInterface], false, 0], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["IsNull", "", [], [Go$Bool], false, 0], ["IsUndefined", "", [], [Go$Bool], false, 0], ["Length", "", [], [Go$Int], false, 0], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["Set", "", [Go$String, go$emptyInterface], [], false, 0], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false, 0], ["String", "", [], [Go$String], false, 0]];
		(go$ptrType(Event)).methods = [["Bool", "", [], [Go$Bool], false, 0], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["Float", "", [], [Go$Float64], false, 0], ["Get", "", [Go$String], [js.Object], false, 0], ["Index", "", [Go$Int], [js.Object], false, 0], ["Int", "", [], [Go$Int], false, 0], ["Interface", "", [], [go$emptyInterface], false, 0], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["IsDefaultPrevented", "", [], [Go$Bool], false, -1], ["IsImmediatePropogationStopped", "", [], [Go$Bool], false, -1], ["IsNull", "", [], [Go$Bool], false, 0], ["IsPropagationStopped", "", [], [Go$Bool], false, -1], ["IsUndefined", "", [], [Go$Bool], false, 0], ["Length", "", [], [Go$Int], false, 0], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["PreventDefault", "", [], [], false, -1], ["Set", "", [Go$String, go$emptyInterface], [], false, 0], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false, 0], ["StopImmediatePropagation", "", [], [], false, -1], ["StopPropagation", "", [], [], false, -1], ["String", "", [], [Go$String], false, 0]];
		Event.init([["Object", "", "", js.Object, ""], ["KeyCode", "KeyCode", "", Go$Int, "js:\"keyCode\""], ["Target", "Target", "", js.Object, "js:\"target\""], ["CurrentTarget", "CurrentTarget", "", js.Object, "js:\"currentTarget\""], ["DelegateTarget", "DelegateTarget", "", js.Object, "js:\"delegateTarget\""], ["RelatedTarget", "RelatedTarget", "", js.Object, "js:\"relatedTarget\""], ["Data", "Data", "", js.Object, "js:\"data\""], ["Result", "Result", "", js.Object, "js:\"result\""], ["Which", "Which", "", Go$Int, "js:\"which\""], ["Namespace", "Namespace", "", Go$String, "js:\"namespace\""], ["MetaKey", "MetaKey", "", Go$Bool, "js:\"metaKey\""], ["PageX", "PageX", "", Go$Int, "js:\"pageX\""], ["PageY", "PageY", "", Go$Int, "js:\"pageY\""], ["Type", "Type", "", Go$String, "js:\"type\""]]);
		JQueryCoordinates.init([["Left", "Left", "", Go$Int, ""], ["Top", "Top", "", Go$Int, ""]]);
	}
	return go$pkg;
})();
go$packages["math"] = (function() {
	var go$pkg = {}, Abs, Inf, NaN, IsNaN, IsInf, normalize, expm1, Floor, Frexp, frexp, hypot, Log, log10, log2, log1p, Mod, remainder, Sqrt, Float64bits, Float64frombits, pow10tab;
	Abs = go$pkg.Abs = Math.abs;
	Inf = go$pkg.Inf = function(sign) { return sign >= 0 ? 1/0 : -1/0; };
	NaN = go$pkg.NaN = function() { return 0/0; };
	IsNaN = go$pkg.IsNaN = function(f) { return f !== f; };
	IsInf = go$pkg.IsInf = function(f, sign) { if (f === -1/0) { return sign <= 0; } if (f === 1/0) { return sign >= 0; } return false; };
	normalize = function(x) {
		var y, exp$1, _tuple, _tuple$1;
		y = 0;
		exp$1 = 0;
		if (Abs(x) < 2.2250738585072014e-308) {
			_tuple = [x * 4.503599627370496e+15, -52], y = _tuple[0], exp$1 = _tuple[1];
			return [y, exp$1];
		}
		_tuple$1 = [x, 0], y = _tuple$1[0], exp$1 = _tuple$1[1];
		return [y, exp$1];
	};
	expm1 = function(x) {
		var absx, sign, c, k, _tuple, hi, lo, t, hfx, hxs, r1, t$1, e, y, x$1, x$2, x$3, t$2, y$1, x$4, x$5, t$3, y$2, x$6, x$7;
		if (IsInf(x, 1) || IsNaN(x)) {
			return x;
		} else if (IsInf(x, -1)) {
			return -1;
		}
		absx = x;
		sign = false;
		if (x < 0) {
			absx = -absx;
			sign = true;
		}
		if (absx >= 38.816242111356935) {
			if (absx >= 709.782712893384) {
				return Inf(1);
			}
			if (sign) {
				return -1;
			}
		}
		c = 0;
		k = 0;
		if (absx > 0.34657359027997264) {
			_tuple = [0, 0], hi = _tuple[0], lo = _tuple[1];
			if (absx < 1.0397207708399179) {
				if (!sign) {
					hi = x - 0.6931471803691238;
					lo = 1.9082149292705877e-10;
					k = 1;
				} else {
					hi = x + 0.6931471803691238;
					lo = -1.9082149292705877e-10;
					k = -1;
				}
			} else {
				if (!sign) {
					k = (1.4426950408889634 * x + 0.5 >> 0);
				} else {
					k = (1.4426950408889634 * x - 0.5 >> 0);
				}
				t = k;
				hi = x - t * 0.6931471803691238;
				lo = t * 1.9082149292705877e-10;
			}
			x = hi - lo;
			c = (hi - x) - lo;
		} else if (absx < 5.551115123125783e-17) {
			return x;
		} else {
			k = 0;
		}
		hfx = 0.5 * x;
		hxs = x * hfx;
		r1 = 1 + hxs * (-0.03333333333333313 + hxs * (0.0015873015872548146 + hxs * (-7.93650757867488e-05 + hxs * (4.008217827329362e-06 + hxs * -2.0109921818362437e-07))));
		t$1 = 3 - r1 * hfx;
		e = hxs * ((r1 - t$1) / (6 - x * t$1));
		if (!((k === 0))) {
			e = x * (e - c) - c;
			e = e - (hxs);
			if (k === -1) {
				return 0.5 * (x - e) - 0.5;
			} else if (k === 1) {
				if (x < -0.25) {
					return -2 * (e - (x + 0.5));
				}
				return 1 + 2 * (x - e);
			} else if (k <= -2 || k > 56) {
				y = 1 - (e - x);
				y = Float64frombits((x$1 = Float64bits(y), x$2 = go$shiftLeft64(new Go$Uint64(0, k), 52), new Go$Uint64(x$1.high + x$2.high, x$1.low + x$2.low)));
				return y - 1;
			}
			if (k < 20) {
				t$2 = Float64frombits((x$3 = go$shiftRightUint64(new Go$Uint64(2097152, 0), (k >>> 0)), new Go$Uint64(1072693248 - x$3.high, 0 - x$3.low)));
				y$1 = t$2 - (e - x);
				y$1 = Float64frombits((x$4 = Float64bits(y$1), x$5 = go$shiftLeft64(new Go$Uint64(0, k), 52), new Go$Uint64(x$4.high + x$5.high, x$4.low + x$5.low)));
				return y$1;
			}
			t$3 = Float64frombits(new Go$Uint64(0, (((1023 - k >> 0)) << 52 >> 0)));
			y$2 = x - (e + t$3);
			y$2 = y$2 + 1;
			y$2 = Float64frombits((x$6 = Float64bits(y$2), x$7 = go$shiftLeft64(new Go$Uint64(0, k), 52), new Go$Uint64(x$6.high + x$7.high, x$6.low + x$7.low)));
			return y$2;
		}
		return x - (x * e - hxs);
	};
	Floor = go$pkg.Floor = Math.floor;
	Frexp = go$pkg.Frexp = function(f) { return frexp(f); };
	frexp = function(f) {
		var frac, exp$1, _tuple, _tuple$1, _tuple$2, x, x$1;
		frac = 0;
		exp$1 = 0;
		if (f === 0) {
			_tuple = [f, 0], frac = _tuple[0], exp$1 = _tuple[1];
			return [frac, exp$1];
		} else if (IsInf(f, 0) || IsNaN(f)) {
			_tuple$1 = [f, 0], frac = _tuple$1[0], exp$1 = _tuple$1[1];
			return [frac, exp$1];
		}
		_tuple$2 = normalize(f), f = _tuple$2[0], exp$1 = _tuple$2[1];
		x = Float64bits(f);
		exp$1 = exp$1 + (((((x$1 = go$shiftRightUint64(x, 52), new Go$Uint64(x$1.high & 0, (x$1.low & 2047) >>> 0)).low >> 0) - 1023 >> 0) + 1 >> 0)) >> 0;
		x = new Go$Uint64(x.high &~ 2146435072, (x.low &~ 0) >>> 0);
		x = new Go$Uint64(x.high | 1071644672, (x.low | 0) >>> 0);
		frac = Float64frombits(x);
		return [frac, exp$1];
	};
	hypot = function(p, q) {
		var _tuple;
		if (IsInf(p, 0) || IsInf(q, 0)) {
			return Inf(1);
		} else if (IsNaN(p) || IsNaN(q)) {
			return NaN();
		}
		if (p < 0) {
			p = -p;
		}
		if (q < 0) {
			q = -q;
		}
		if (p < q) {
			_tuple = [q, p], p = _tuple[0], q = _tuple[1];
		}
		if (p === 0) {
			return 0;
		}
		q = q / p;
		return p * Sqrt(1 + q * q);
	};
	Log = go$pkg.Log = Math.log;
	log10 = function(x) {
		return Log(x) * 0.4342944819032518;
	};
	log2 = function(x) {
		var _tuple, frac, exp$1;
		_tuple = Frexp(x), frac = _tuple[0], exp$1 = _tuple[1];
		return Log(frac) * 1.4426950408889634 + exp$1;
	};
	log1p = function(x) {
		var absx, f, iu, k, c, u, x$1, x$2, hfsq, _tuple, s, R, z;
		if (x < -1 || IsNaN(x)) {
			return NaN();
		} else if (x === -1) {
			return Inf(-1);
		} else if (IsInf(x, 1)) {
			return Inf(1);
		}
		absx = x;
		if (absx < 0) {
			absx = -absx;
		}
		f = 0;
		iu = new Go$Uint64(0, 0);
		k = 1;
		if (absx < 0.41421356237309503) {
			if (absx < 1.862645149230957e-09) {
				if (absx < 5.551115123125783e-17) {
					return x;
				}
				return x - x * x * 0.5;
			}
			if (x > -0.2928932188134525) {
				k = 0;
				f = x;
				iu = new Go$Uint64(0, 1);
			}
		}
		c = 0;
		if (!((k === 0))) {
			u = 0;
			if (absx < 9.007199254740992e+15) {
				u = 1 + x;
				iu = Float64bits(u);
				k = ((x$1 = go$shiftRightUint64(iu, 52), new Go$Uint64(x$1.high - 0, x$1.low - 1023)).low >> 0);
				if (k > 0) {
					c = 1 - (u - x);
				} else {
					c = x - (u - 1);
					c = c / (u);
				}
			} else {
				u = x;
				iu = Float64bits(u);
				k = ((x$2 = go$shiftRightUint64(iu, 52), new Go$Uint64(x$2.high - 0, x$2.low - 1023)).low >> 0);
				c = 0;
			}
			iu = new Go$Uint64(iu.high & 1048575, (iu.low & 4294967295) >>> 0);
			if ((iu.high < 434334 || (iu.high === 434334 && iu.low < 1719614413))) {
				u = Float64frombits(new Go$Uint64(iu.high | 1072693248, (iu.low | 0) >>> 0));
			} else {
				k = k + 1 >> 0;
				u = Float64frombits(new Go$Uint64(iu.high | 1071644672, (iu.low | 0) >>> 0));
				iu = go$shiftRightUint64((new Go$Uint64(1048576 - iu.high, 0 - iu.low)), 2);
			}
			f = u - 1;
		}
		hfsq = 0.5 * f * f;
		_tuple = [0, 0, 0], s = _tuple[0], R = _tuple[1], z = _tuple[2];
		if ((iu.high === 0 && iu.low === 0)) {
			if (f === 0) {
				if (k === 0) {
					return 0;
				} else {
					c = c + (k * 1.9082149292705877e-10);
					return k * 0.6931471803691238 + c;
				}
			}
			R = hfsq * (1 - 0.6666666666666666 * f);
			if (k === 0) {
				return f - R;
			}
			return k * 0.6931471803691238 - ((R - (k * 1.9082149292705877e-10 + c)) - f);
		}
		s = f / (2 + f);
		z = s * s;
		R = z * (0.6666666666666735 + z * (0.3999999999940942 + z * (0.2857142874366239 + z * (0.22222198432149784 + z * (0.1818357216161805 + z * (0.15313837699209373 + z * 0.14798198605116586))))));
		if (k === 0) {
			return f - (hfsq - s * (hfsq + R));
		}
		return k * 0.6931471803691238 - ((hfsq - (s * (hfsq + R) + (k * 1.9082149292705877e-10 + c))) - f);
	};
	Mod = go$pkg.Mod = function(x, y) { return x % y; };
	remainder = function(x, y) {
		var sign, yHalf;
		if (IsNaN(x) || IsNaN(y) || IsInf(x, 0) || (y === 0)) {
			return NaN();
		} else if (IsInf(y, 0)) {
			return x;
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		if (y < 0) {
			y = -y;
		}
		if (x === y) {
			return 0;
		}
		if (y <= 8.988465674311579e+307) {
			x = Mod(x, y + y);
		}
		if (y < 4.450147717014403e-308) {
			if (x + x > y) {
				x = x - (y);
				if (x + x >= y) {
					x = x - (y);
				}
			}
		} else {
			yHalf = 0.5 * y;
			if (x > yHalf) {
				x = x - (y);
				if (x >= yHalf) {
					x = x - (y);
				}
			}
		}
		if (sign) {
			x = -x;
		}
		return x;
	};
	Sqrt = go$pkg.Sqrt = Math.sqrt;
	Float64bits = go$pkg.Float64bits = function(f) {
			var s, e, x, x$1, x$2, x$3;
			if (f === 0) {
				if (f === 0 && 1 / f === 1 / -0) {
					return new Go$Uint64(2147483648, 0);
				}
				return new Go$Uint64(0, 0);
			}
			if (f !== f) {
				return new Go$Uint64(2146959360, 1);
			}
			s = new Go$Uint64(0, 0);
			if (f < 0) {
				s = new Go$Uint64(2147483648, 0);
				f = -f;
			}
			e = 1075;
			while (f >= 9.007199254740992e+15) {
				f = f / 2;
				if (e === 2047) {
					break;
				}
				e = e + 1 >>> 0;
			}
			while (f < 4.503599627370496e+15) {
				e = e - 1 >>> 0;
				if (e === 0) {
					break;
				}
				f = f * 2;
			}
			return (x = (x$1 = go$shiftLeft64(new Go$Uint64(0, e), 52), new Go$Uint64(s.high | x$1.high, (s.low | x$1.low) >>> 0)), x$2 = (x$3 = new Go$Uint64(0, f), new Go$Uint64(x$3.high &~ 1048576, (x$3.low &~ 0) >>> 0)), new Go$Uint64(x.high | x$2.high, (x.low | x$2.low) >>> 0));
		};
	Float64frombits = go$pkg.Float64frombits = function(b) {
			var s, x, x$1, e, m;
			s = 1;
			if (!((x = new Go$Uint64(b.high & 2147483648, (b.low & 0) >>> 0), (x.high === 0 && x.low === 0)))) {
				s = -1;
			}
			e = (x$1 = go$shiftRightUint64(b, 52), new Go$Uint64(x$1.high & 0, (x$1.low & 2047) >>> 0));
			m = new Go$Uint64(b.high & 1048575, (b.low & 4294967295) >>> 0);
			if ((e.high === 0 && e.low === 2047)) {
				if ((m.high === 0 && m.low === 0)) {
					return s / 0;
				}
				return 0/0;
			}
			if (!((e.high === 0 && e.low === 0))) {
				m = new Go$Uint64(m.high + 1048576, m.low + 0);
			}
			if ((e.high === 0 && e.low === 0)) {
				e = new Go$Uint64(0, 1);
			}
			return go$ldexp(go$flatten64(m), ((e.low >> 0) - 1023 >> 0) - 52 >> 0) * s;
		};
	go$pkg.init = function() {
		pow10tab = go$makeNativeArray("Float64", 70, function() { return 0; });
		var i, _q, m;
		pow10tab[0] = 1;
		pow10tab[1] = 10;
		i = 2;
		while (i < 70) {
			m = (_q = i / 2, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
			pow10tab[i] = pow10tab[m] * pow10tab[(i - m >> 0)];
			i = i + 1 >> 0;
		}
	}
	return go$pkg;
})();
go$packages["errors"] = (function() {
	var go$pkg = {}, errorString, New;
	errorString = go$pkg.errorString = go$newType(0, "Struct", "errors.errorString", "errorString", "errors", function(s_) {
		this.go$val = this;
		this.s = s_ !== undefined ? s_ : "";
	});
	New = go$pkg.New = function(text) {
		return new errorString.Ptr(text);
	};
	errorString.Ptr.prototype.Error = function() {
		var e;
		e = this;
		return e.s;
	};
	errorString.prototype.Error = function() { return this.go$val.Error(); };
	go$pkg.init = function() {
		(go$ptrType(errorString)).methods = [["Error", "", [], [Go$String], false, -1]];
		errorString.init([["s", "s", "errors", Go$String, ""]]);
	}
	return go$pkg;
})();
go$packages["unicode/utf8"] = (function() {
	var go$pkg = {}, decodeRuneInStringInternal, DecodeRuneInString, EncodeRune;
	decodeRuneInStringInternal = function(s) {
		var r, size, short$1, n, _tuple, c0, _tuple$1, _tuple$2, _tuple$3, c1, _tuple$4, _tuple$5, _tuple$6, _tuple$7, c2, _tuple$8, _tuple$9, _tuple$10, _tuple$11, _tuple$12, c3, _tuple$13, _tuple$14, _tuple$15, _tuple$16;
		r = 0;
		size = 0;
		short$1 = false;
		n = s.length;
		if (n < 1) {
			_tuple = [65533, 0, true], r = _tuple[0], size = _tuple[1], short$1 = _tuple[2];
			return [r, size, short$1];
		}
		c0 = s.charCodeAt(0);
		if (c0 < 128) {
			_tuple$1 = [(c0 >> 0), 1, false], r = _tuple$1[0], size = _tuple$1[1], short$1 = _tuple$1[2];
			return [r, size, short$1];
		}
		if (c0 < 192) {
			_tuple$2 = [65533, 1, false], r = _tuple$2[0], size = _tuple$2[1], short$1 = _tuple$2[2];
			return [r, size, short$1];
		}
		if (n < 2) {
			_tuple$3 = [65533, 1, true], r = _tuple$3[0], size = _tuple$3[1], short$1 = _tuple$3[2];
			return [r, size, short$1];
		}
		c1 = s.charCodeAt(1);
		if (c1 < 128 || 192 <= c1) {
			_tuple$4 = [65533, 1, false], r = _tuple$4[0], size = _tuple$4[1], short$1 = _tuple$4[2];
			return [r, size, short$1];
		}
		if (c0 < 224) {
			r = ((((c0 & 31) >>> 0) >> 0) << 6 >> 0) | (((c1 & 63) >>> 0) >> 0);
			if (r <= 127) {
				_tuple$5 = [65533, 1, false], r = _tuple$5[0], size = _tuple$5[1], short$1 = _tuple$5[2];
				return [r, size, short$1];
			}
			_tuple$6 = [r, 2, false], r = _tuple$6[0], size = _tuple$6[1], short$1 = _tuple$6[2];
			return [r, size, short$1];
		}
		if (n < 3) {
			_tuple$7 = [65533, 1, true], r = _tuple$7[0], size = _tuple$7[1], short$1 = _tuple$7[2];
			return [r, size, short$1];
		}
		c2 = s.charCodeAt(2);
		if (c2 < 128 || 192 <= c2) {
			_tuple$8 = [65533, 1, false], r = _tuple$8[0], size = _tuple$8[1], short$1 = _tuple$8[2];
			return [r, size, short$1];
		}
		if (c0 < 240) {
			r = (((((c0 & 15) >>> 0) >> 0) << 12 >> 0) | ((((c1 & 63) >>> 0) >> 0) << 6 >> 0)) | (((c2 & 63) >>> 0) >> 0);
			if (r <= 2047) {
				_tuple$9 = [65533, 1, false], r = _tuple$9[0], size = _tuple$9[1], short$1 = _tuple$9[2];
				return [r, size, short$1];
			}
			if (55296 <= r && r <= 57343) {
				_tuple$10 = [65533, 1, false], r = _tuple$10[0], size = _tuple$10[1], short$1 = _tuple$10[2];
				return [r, size, short$1];
			}
			_tuple$11 = [r, 3, false], r = _tuple$11[0], size = _tuple$11[1], short$1 = _tuple$11[2];
			return [r, size, short$1];
		}
		if (n < 4) {
			_tuple$12 = [65533, 1, true], r = _tuple$12[0], size = _tuple$12[1], short$1 = _tuple$12[2];
			return [r, size, short$1];
		}
		c3 = s.charCodeAt(3);
		if (c3 < 128 || 192 <= c3) {
			_tuple$13 = [65533, 1, false], r = _tuple$13[0], size = _tuple$13[1], short$1 = _tuple$13[2];
			return [r, size, short$1];
		}
		if (c0 < 248) {
			r = ((((((c0 & 7) >>> 0) >> 0) << 18 >> 0) | ((((c1 & 63) >>> 0) >> 0) << 12 >> 0)) | ((((c2 & 63) >>> 0) >> 0) << 6 >> 0)) | (((c3 & 63) >>> 0) >> 0);
			if (r <= 65535 || 1114111 < r) {
				_tuple$14 = [65533, 1, false], r = _tuple$14[0], size = _tuple$14[1], short$1 = _tuple$14[2];
				return [r, size, short$1];
			}
			_tuple$15 = [r, 4, false], r = _tuple$15[0], size = _tuple$15[1], short$1 = _tuple$15[2];
			return [r, size, short$1];
		}
		_tuple$16 = [65533, 1, false], r = _tuple$16[0], size = _tuple$16[1], short$1 = _tuple$16[2];
		return [r, size, short$1];
	};
	DecodeRuneInString = go$pkg.DecodeRuneInString = function(s) {
		var r, size, _tuple;
		r = 0;
		size = 0;
		_tuple = decodeRuneInStringInternal(s), r = _tuple[0], size = _tuple[1];
		return [r, size];
	};
	EncodeRune = go$pkg.EncodeRune = function(p, r) {
		var _slice, _index, _slice$1, _index$1, _slice$2, _index$2, _slice$3, _index$3, _slice$4, _index$4, _slice$5, _index$5, _slice$6, _index$6, _slice$7, _index$7, _slice$8, _index$8, _slice$9, _index$9;
		if ((r >>> 0) <= 127) {
			_slice = p, _index = 0, (_index >= 0 && _index < _slice.length) ? (_slice.array[_slice.offset + _index] = (r << 24 >>> 24)) : go$throwRuntimeError("index out of range");
			return 1;
		}
		if ((r >>> 0) <= 2047) {
			_slice$1 = p, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = (192 | ((r >> 6 >> 0) << 24 >>> 24)) >>> 0) : go$throwRuntimeError("index out of range");
			_slice$2 = p, _index$2 = 1, (_index$2 >= 0 && _index$2 < _slice$2.length) ? (_slice$2.array[_slice$2.offset + _index$2] = (128 | (((r << 24 >>> 24) & 63) >>> 0)) >>> 0) : go$throwRuntimeError("index out of range");
			return 2;
		}
		if ((r >>> 0) > 1114111) {
			r = 65533;
		}
		if (55296 <= r && r <= 57343) {
			r = 65533;
		}
		if ((r >>> 0) <= 65535) {
			_slice$3 = p, _index$3 = 0, (_index$3 >= 0 && _index$3 < _slice$3.length) ? (_slice$3.array[_slice$3.offset + _index$3] = (224 | ((r >> 12 >> 0) << 24 >>> 24)) >>> 0) : go$throwRuntimeError("index out of range");
			_slice$4 = p, _index$4 = 1, (_index$4 >= 0 && _index$4 < _slice$4.length) ? (_slice$4.array[_slice$4.offset + _index$4] = (128 | ((((r >> 6 >> 0) << 24 >>> 24) & 63) >>> 0)) >>> 0) : go$throwRuntimeError("index out of range");
			_slice$5 = p, _index$5 = 2, (_index$5 >= 0 && _index$5 < _slice$5.length) ? (_slice$5.array[_slice$5.offset + _index$5] = (128 | (((r << 24 >>> 24) & 63) >>> 0)) >>> 0) : go$throwRuntimeError("index out of range");
			return 3;
		}
		_slice$6 = p, _index$6 = 0, (_index$6 >= 0 && _index$6 < _slice$6.length) ? (_slice$6.array[_slice$6.offset + _index$6] = (240 | ((r >> 18 >> 0) << 24 >>> 24)) >>> 0) : go$throwRuntimeError("index out of range");
		_slice$7 = p, _index$7 = 1, (_index$7 >= 0 && _index$7 < _slice$7.length) ? (_slice$7.array[_slice$7.offset + _index$7] = (128 | ((((r >> 12 >> 0) << 24 >>> 24) & 63) >>> 0)) >>> 0) : go$throwRuntimeError("index out of range");
		_slice$8 = p, _index$8 = 2, (_index$8 >= 0 && _index$8 < _slice$8.length) ? (_slice$8.array[_slice$8.offset + _index$8] = (128 | ((((r >> 6 >> 0) << 24 >>> 24) & 63) >>> 0)) >>> 0) : go$throwRuntimeError("index out of range");
		_slice$9 = p, _index$9 = 3, (_index$9 >= 0 && _index$9 < _slice$9.length) ? (_slice$9.array[_slice$9.offset + _index$9] = (128 | (((r << 24 >>> 24) & 63) >>> 0)) >>> 0) : go$throwRuntimeError("index out of range");
		return 4;
	};
	go$pkg.init = function() {
	}
	return go$pkg;
})();
go$packages["strconv"] = (function() {
	var go$pkg = {}, math = go$packages["math"], errors = go$packages["errors"], utf8 = go$packages["unicode/utf8"], NumError, syntaxError, rangeError, cutoff64, ParseUint, ParseInt, Atoi, FormatInt, Itoa, formatBits, quoteWith, Quote, bsearch16, bsearch32, IsPrint, isPrint16, isNotPrint16, isPrint32, isNotPrint32, shifts;
	NumError = go$pkg.NumError = go$newType(0, "Struct", "strconv.NumError", "NumError", "strconv", function(Func_, Num_, Err_) {
		this.go$val = this;
		this.Func = Func_ !== undefined ? Func_ : "";
		this.Num = Num_ !== undefined ? Num_ : "";
		this.Err = Err_ !== undefined ? Err_ : null;
	});
	NumError.Ptr.prototype.Error = function() {
		var e;
		e = this;
		return "strconv." + e.Func + ": " + "parsing " + Quote(e.Num) + ": " + e.Err.Error();
	};
	NumError.prototype.Error = function() { return this.go$val.Error(); };
	syntaxError = function(fn, str) {
		return new NumError.Ptr(fn, str, go$pkg.ErrSyntax);
	};
	rangeError = function(fn, str) {
		return new NumError.Ptr(fn, str, go$pkg.ErrRange);
	};
	cutoff64 = function(base) {
		var x;
		if (base < 2) {
			return new Go$Uint64(0, 0);
		}
		return (x = go$div64(new Go$Uint64(4294967295, 4294967295), new Go$Uint64(0, base), false), new Go$Uint64(x.high + 0, x.low + 1));
	};
	ParseUint = go$pkg.ParseUint = function(s, base, bitSize) {
		var go$this = this, n, err, _tuple, cutoff, maxVal, s0, x, i, v, d, x$1, n1, _tuple$1, _tuple$2;
		n = new Go$Uint64(0, 0);
		err = null;
		/* */ var go$s = 0, go$f = function() { while (true) { switch (go$s) { case 0:
		_tuple = [new Go$Uint64(0, 0), new Go$Uint64(0, 0)], cutoff = _tuple[0], maxVal = _tuple[1];
		if (bitSize === 0) {
			bitSize = 32;
		}
		s0 = s;
		/* if (s.length < 1) { */ if (s.length < 1) {} else if (2 <= base && base <= 36) { go$s = 2; continue; } else if (base === 0) { go$s = 3; continue; } else { go$s = 4; continue; }
			err = go$pkg.ErrSyntax;
			/* goto Error */ go$s = 1; continue;
		/* } else if (2 <= base && base <= 36) { */ go$s = 5; continue; case 2: 
		/* } else if (base === 0) { */ go$s = 5; continue; case 3: 
			/* if ((s.charCodeAt(0) === 48) && s.length > 1 && ((s.charCodeAt(1) === 120) || (s.charCodeAt(1) === 88))) { */ if ((s.charCodeAt(0) === 48) && s.length > 1 && ((s.charCodeAt(1) === 120) || (s.charCodeAt(1) === 88))) {} else if (s.charCodeAt(0) === 48) { go$s = 6; continue; } else { go$s = 7; continue; }
				base = 16;
				s = s.substring(2);
				/* if (s.length < 1) { */ if (s.length < 1) {} else { go$s = 9; continue; }
					err = go$pkg.ErrSyntax;
					/* goto Error */ go$s = 1; continue;
				/* } */ case 9:
			/* } else if (s.charCodeAt(0) === 48) { */ go$s = 8; continue; case 6: 
				base = 8;
			/* } else { */ go$s = 8; continue; case 7: 
				base = 10;
			/* } */ case 8:
		/* } else { */ go$s = 5; continue; case 4: 
			err = errors.New("invalid base " + Itoa(base));
			/* goto Error */ go$s = 1; continue;
		/* } */ case 5:
		n = new Go$Uint64(0, 0);
		cutoff = cutoff64(base);
		maxVal = (x = go$shiftLeft64(new Go$Uint64(0, 1), (bitSize >>> 0)), new Go$Uint64(x.high - 0, x.low - 1));
		i = 0;
		/* while (i < s.length) { */ case 10: if(!(i < s.length)) { go$s = 11; continue; }
			v = 0;
			d = s.charCodeAt(i);
			/* if (48 <= d && d <= 57) { */ if (48 <= d && d <= 57) {} else if (97 <= d && d <= 122) { go$s = 12; continue; } else if (65 <= d && d <= 90) { go$s = 13; continue; } else { go$s = 14; continue; }
				v = d - 48 << 24 >>> 24;
			/* } else if (97 <= d && d <= 122) { */ go$s = 15; continue; case 12: 
				v = (d - 97 << 24 >>> 24) + 10 << 24 >>> 24;
			/* } else if (65 <= d && d <= 90) { */ go$s = 15; continue; case 13: 
				v = (d - 65 << 24 >>> 24) + 10 << 24 >>> 24;
			/* } else { */ go$s = 15; continue; case 14: 
				n = new Go$Uint64(0, 0);
				err = go$pkg.ErrSyntax;
				/* goto Error */ go$s = 1; continue;
			/* } */ case 15:
			/* if ((v >> 0) >= base) { */ if ((v >> 0) >= base) {} else { go$s = 16; continue; }
				n = new Go$Uint64(0, 0);
				err = go$pkg.ErrSyntax;
				/* goto Error */ go$s = 1; continue;
			/* } */ case 16:
			/* if ((n.high > cutoff.high || (n.high === cutoff.high && n.low >= cutoff.low))) { */ if ((n.high > cutoff.high || (n.high === cutoff.high && n.low >= cutoff.low))) {} else { go$s = 17; continue; }
				n = new Go$Uint64(4294967295, 4294967295);
				err = go$pkg.ErrRange;
				/* goto Error */ go$s = 1; continue;
			/* } */ case 17:
			n = go$mul64(n, (new Go$Uint64(0, base)));
			n1 = (x$1 = new Go$Uint64(0, v), new Go$Uint64(n.high + x$1.high, n.low + x$1.low));
			/* if ((n1.high < n.high || (n1.high === n.high && n1.low < n.low)) || (n1.high > maxVal.high || (n1.high === maxVal.high && n1.low > maxVal.low))) { */ if ((n1.high < n.high || (n1.high === n.high && n1.low < n.low)) || (n1.high > maxVal.high || (n1.high === maxVal.high && n1.low > maxVal.low))) {} else { go$s = 18; continue; }
				n = new Go$Uint64(4294967295, 4294967295);
				err = go$pkg.ErrRange;
				/* goto Error */ go$s = 1; continue;
			/* } */ case 18:
			n = n1;
			i = i + 1 >> 0;
		/* } */ go$s = 10; continue; case 11:
		_tuple$1 = [n, null], n = _tuple$1[0], err = _tuple$1[1];
		return [n, err];
		/* Error: */ case 1:
		_tuple$2 = [n, new NumError.Ptr("ParseUint", s0, err)], n = _tuple$2[0], err = _tuple$2[1];
		return [n, err];
		/* */ } break; } }; return go$f();
	};
	ParseInt = go$pkg.ParseInt = function(s, base, bitSize) {
		var i, err, _tuple, s0, neg, un, _tuple$1, _tuple$2, cutoff, x, _tuple$3, x$1, _tuple$4, n, _tuple$5;
		i = new Go$Int64(0, 0);
		err = null;
		if (bitSize === 0) {
			bitSize = 32;
		}
		if (s.length === 0) {
			_tuple = [new Go$Int64(0, 0), syntaxError("ParseInt", s)], i = _tuple[0], err = _tuple[1];
			return [i, err];
		}
		s0 = s;
		neg = false;
		if (s.charCodeAt(0) === 43) {
			s = s.substring(1);
		} else if (s.charCodeAt(0) === 45) {
			neg = true;
			s = s.substring(1);
		}
		un = new Go$Uint64(0, 0);
		_tuple$1 = ParseUint(s, base, bitSize), un = _tuple$1[0], err = _tuple$1[1];
		if (!(go$interfaceIsEqual(err, null)) && !(go$interfaceIsEqual((err !== null && err.constructor === (go$ptrType(NumError)) ? err.go$val : go$typeAssertionFailed(err, (go$ptrType(NumError)))).Err, go$pkg.ErrRange))) {
			(err !== null && err.constructor === (go$ptrType(NumError)) ? err.go$val : go$typeAssertionFailed(err, (go$ptrType(NumError)))).Func = "ParseInt";
			(err !== null && err.constructor === (go$ptrType(NumError)) ? err.go$val : go$typeAssertionFailed(err, (go$ptrType(NumError)))).Num = s0;
			_tuple$2 = [new Go$Int64(0, 0), err], i = _tuple$2[0], err = _tuple$2[1];
			return [i, err];
		}
		cutoff = go$shiftLeft64(new Go$Uint64(0, 1), ((bitSize - 1 >> 0) >>> 0));
		if (!neg && (un.high > cutoff.high || (un.high === cutoff.high && un.low >= cutoff.low))) {
			_tuple$3 = [(x = new Go$Uint64(cutoff.high - 0, cutoff.low - 1), new Go$Int64(x.high, x.low)), rangeError("ParseInt", s0)], i = _tuple$3[0], err = _tuple$3[1];
			return [i, err];
		}
		if (neg && (un.high > cutoff.high || (un.high === cutoff.high && un.low > cutoff.low))) {
			_tuple$4 = [(x$1 = new Go$Int64(cutoff.high, cutoff.low), new Go$Int64(-x$1.high, -x$1.low)), rangeError("ParseInt", s0)], i = _tuple$4[0], err = _tuple$4[1];
			return [i, err];
		}
		n = new Go$Int64(un.high, un.low);
		if (neg) {
			n = new Go$Int64(-n.high, -n.low);
		}
		_tuple$5 = [n, null], i = _tuple$5[0], err = _tuple$5[1];
		return [i, err];
	};
	Atoi = go$pkg.Atoi = function(s) {
		var i, err, _tuple, i64, _tuple$1;
		i = 0;
		err = null;
		_tuple = ParseInt(s, 10, 0), i64 = _tuple[0], err = _tuple[1];
		_tuple$1 = [((i64.low + ((i64.high >> 31) * 4294967296)) >> 0), err], i = _tuple$1[0], err = _tuple$1[1];
		return [i, err];
	};
	FormatInt = go$pkg.FormatInt = function(i, base) {
		var _tuple, s;
		_tuple = formatBits((go$sliceType(Go$Uint8)).nil, new Go$Uint64(i.high, i.low), base, (i.high < 0 || (i.high === 0 && i.low < 0)), false), s = _tuple[1];
		return s;
	};
	Itoa = go$pkg.Itoa = function(i) {
		return FormatInt(new Go$Int64(0, i), 10);
	};
	formatBits = function(dst, u, base, neg, append_) {
		var d, s, a, i, q, x, j, q$1, x$1, s$1, b, m, b$1;
		d = (go$sliceType(Go$Uint8)).nil;
		s = "";
		if (base < 2 || base > 36) {
			throw go$panic(new Go$String("strconv: illegal AppendInt/FormatInt base"));
		}
		a = go$makeNativeArray("Uint8", 65, function() { return 0; });
		i = 65;
		if (neg) {
			u = new Go$Uint64(-u.high, -u.low);
		}
		if (base === 10) {
			while ((u.high > 0 || (u.high === 0 && u.low >= 100))) {
				i = i - 2 >> 0;
				q = go$div64(u, new Go$Uint64(0, 100), false);
				j = ((x = go$mul64(q, new Go$Uint64(0, 100)), new Go$Uint64(u.high - x.high, u.low - x.low)).low >>> 0);
				a[i + 1 >> 0] = "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789".charCodeAt(j);
				a[i + 0 >> 0] = "0000000000111111111122222222223333333333444444444455555555556666666666777777777788888888889999999999".charCodeAt(j);
				u = q;
			}
			if ((u.high > 0 || (u.high === 0 && u.low >= 10))) {
				i = i - 1 >> 0;
				q$1 = go$div64(u, new Go$Uint64(0, 10), false);
				a[i] = "0123456789abcdefghijklmnopqrstuvwxyz".charCodeAt(((x$1 = go$mul64(q$1, new Go$Uint64(0, 10)), new Go$Uint64(u.high - x$1.high, u.low - x$1.low)).low >>> 0));
				u = q$1;
			}
		} else {
			s$1 = shifts[base];
			if (s$1 > 0) {
				b = new Go$Uint64(0, base);
				m = (b.low >>> 0) - 1 >>> 0;
				while ((u.high > b.high || (u.high === b.high && u.low >= b.low))) {
					i = i - 1 >> 0;
					a[i] = "0123456789abcdefghijklmnopqrstuvwxyz".charCodeAt((((u.low >>> 0) & m) >>> 0));
					u = go$shiftRightUint64(u, (s$1));
				}
			} else {
				b$1 = new Go$Uint64(0, base);
				while ((u.high > b$1.high || (u.high === b$1.high && u.low >= b$1.low))) {
					i = i - 1 >> 0;
					a[i] = "0123456789abcdefghijklmnopqrstuvwxyz".charCodeAt((go$div64(u, b$1, true).low >>> 0));
					u = go$div64(u, (b$1), false);
				}
			}
		}
		i = i - 1 >> 0;
		a[i] = "0123456789abcdefghijklmnopqrstuvwxyz".charCodeAt((u.low >>> 0));
		if (neg) {
			i = i - 1 >> 0;
			a[i] = 45;
		}
		if (append_) {
			d = go$appendSlice(dst, go$subslice(new (go$sliceType(Go$Uint8))(a), i));
			return [d, s];
		}
		s = go$bytesToString(go$subslice(new (go$sliceType(Go$Uint8))(a), i));
		return [d, s];
	};
	quoteWith = function(s, quote, ASCIIonly) {
		var runeTmp, _q, x, x$1, buf, width, r, _tuple, n, _ref, s$1, s$2;
		runeTmp = go$makeNativeArray("Uint8", 4, function() { return 0; });
		buf = (go$sliceType(Go$Uint8)).make(0, (_q = (x = 3, x$1 = s.length, (((x >>> 16 << 16) * x$1 >> 0) + (x << 16 >>> 16) * x$1) >> 0) / 2, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero")), function() { return 0; });
		buf = go$append(buf, quote);
		width = 0;
		while (s.length > 0) {
			r = (s.charCodeAt(0) >> 0);
			width = 1;
			if (r >= 128) {
				_tuple = utf8.DecodeRuneInString(s), r = _tuple[0], width = _tuple[1];
			}
			if ((width === 1) && (r === 65533)) {
				buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\x")));
				buf = go$append(buf, "0123456789abcdef".charCodeAt((s.charCodeAt(0) >>> 4 << 24 >>> 24)));
				buf = go$append(buf, "0123456789abcdef".charCodeAt(((s.charCodeAt(0) & 15) >>> 0)));
				s = s.substring(width);
				continue;
			}
			if ((r === (quote >> 0)) || (r === 92)) {
				buf = go$append(buf, 92);
				buf = go$append(buf, (r << 24 >>> 24));
				s = s.substring(width);
				continue;
			}
			if (ASCIIonly) {
				if (r < 128 && IsPrint(r)) {
					buf = go$append(buf, (r << 24 >>> 24));
					s = s.substring(width);
					continue;
				}
			} else if (IsPrint(r)) {
				n = utf8.EncodeRune(new (go$sliceType(Go$Uint8))(runeTmp), r);
				buf = go$appendSlice(buf, go$subslice(new (go$sliceType(Go$Uint8))(runeTmp), 0, n));
				s = s.substring(width);
				continue;
			}
			_ref = r;
			if (_ref === 7) {
				buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\a")));
			} else if (_ref === 8) {
				buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\b")));
			} else if (_ref === 12) {
				buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\f")));
			} else if (_ref === 10) {
				buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\n")));
			} else if (_ref === 13) {
				buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\r")));
			} else if (_ref === 9) {
				buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\t")));
			} else if (_ref === 11) {
				buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\v")));
			} else {
				if (r < 32) {
					buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\x")));
					buf = go$append(buf, "0123456789abcdef".charCodeAt((s.charCodeAt(0) >>> 4 << 24 >>> 24)));
					buf = go$append(buf, "0123456789abcdef".charCodeAt(((s.charCodeAt(0) & 15) >>> 0)));
				} else if (r > 1114111) {
					r = 65533;
					buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\u")));
					s$1 = 12;
					while (s$1 >= 0) {
						buf = go$append(buf, "0123456789abcdef".charCodeAt((((r >> go$min((s$1 >>> 0), 31)) >> 0) & 15)));
						s$1 = s$1 - 4 >> 0;
					}
				} else if (r < 65536) {
					buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\u")));
					s$1 = 12;
					while (s$1 >= 0) {
						buf = go$append(buf, "0123456789abcdef".charCodeAt((((r >> go$min((s$1 >>> 0), 31)) >> 0) & 15)));
						s$1 = s$1 - 4 >> 0;
					}
				} else {
					buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\U")));
					s$2 = 28;
					while (s$2 >= 0) {
						buf = go$append(buf, "0123456789abcdef".charCodeAt((((r >> go$min((s$2 >>> 0), 31)) >> 0) & 15)));
						s$2 = s$2 - 4 >> 0;
					}
				}
			}
			s = s.substring(width);
		}
		buf = go$append(buf, quote);
		return go$bytesToString(buf);
	};
	Quote = go$pkg.Quote = function(s) {
		return quoteWith(s, 34, false);
	};
	bsearch16 = function(a, x) {
		var _tuple, i, j, _q, h, _slice, _index;
		_tuple = [0, a.length], i = _tuple[0], j = _tuple[1];
		while (i < j) {
			h = i + (_q = ((j - i >> 0)) / 2, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero")) >> 0;
			if ((_slice = a, _index = h, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) < x) {
				i = h + 1 >> 0;
			} else {
				j = h;
			}
		}
		return i;
	};
	bsearch32 = function(a, x) {
		var _tuple, i, j, _q, h, _slice, _index;
		_tuple = [0, a.length], i = _tuple[0], j = _tuple[1];
		while (i < j) {
			h = i + (_q = ((j - i >> 0)) / 2, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero")) >> 0;
			if ((_slice = a, _index = h, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) < x) {
				i = h + 1 >> 0;
			} else {
				j = h;
			}
		}
		return i;
	};
	IsPrint = go$pkg.IsPrint = function(r) {
		var _tuple, rr, isPrint, isNotPrint, i, _slice, _index, _slice$1, _index$1, j, _slice$2, _index$2, _tuple$1, rr$1, isPrint$1, isNotPrint$1, i$1, _slice$3, _index$3, _slice$4, _index$4, j$1, _slice$5, _index$5;
		if (r <= 255) {
			if (32 <= r && r <= 126) {
				return true;
			}
			if (161 <= r && r <= 255) {
				return !((r === 173));
			}
			return false;
		}
		if (0 <= r && r < 65536) {
			_tuple = [(r << 16 >>> 16), isPrint16, isNotPrint16], rr = _tuple[0], isPrint = _tuple[1], isNotPrint = _tuple[2];
			i = bsearch16(isPrint, rr);
			if (i >= isPrint.length || rr < (_slice = isPrint, _index = (i & ~1), (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) || (_slice$1 = isPrint, _index$1 = (i | 1), (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")) < rr) {
				return false;
			}
			j = bsearch16(isNotPrint, rr);
			return j >= isNotPrint.length || !(((_slice$2 = isNotPrint, _index$2 = j, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")) === rr));
		}
		_tuple$1 = [(r >>> 0), isPrint32, isNotPrint32], rr$1 = _tuple$1[0], isPrint$1 = _tuple$1[1], isNotPrint$1 = _tuple$1[2];
		i$1 = bsearch32(isPrint$1, rr$1);
		if (i$1 >= isPrint$1.length || rr$1 < (_slice$3 = isPrint$1, _index$3 = (i$1 & ~1), (_index$3 >= 0 && _index$3 < _slice$3.length) ? _slice$3.array[_slice$3.offset + _index$3] : go$throwRuntimeError("index out of range")) || (_slice$4 = isPrint$1, _index$4 = (i$1 | 1), (_index$4 >= 0 && _index$4 < _slice$4.length) ? _slice$4.array[_slice$4.offset + _index$4] : go$throwRuntimeError("index out of range")) < rr$1) {
			return false;
		}
		if (r >= 131072) {
			return true;
		}
		r = r - 65536 >> 0;
		j$1 = bsearch16(isNotPrint$1, (r << 16 >>> 16));
		return j$1 >= isNotPrint$1.length || !(((_slice$5 = isNotPrint$1, _index$5 = j$1, (_index$5 >= 0 && _index$5 < _slice$5.length) ? _slice$5.array[_slice$5.offset + _index$5] : go$throwRuntimeError("index out of range")) === (r << 16 >>> 16)));
	};
	go$pkg.init = function() {
		(go$ptrType(NumError)).methods = [["Error", "", [], [Go$String], false, -1]];
		NumError.init([["Func", "Func", "", Go$String, ""], ["Num", "Num", "", Go$String, ""], ["Err", "Err", "", go$error, ""]]);
		go$pkg.ErrRange = errors.New("value out of range");
		go$pkg.ErrSyntax = errors.New("invalid syntax");
		isPrint16 = new (go$sliceType(Go$Uint16))([32, 126, 161, 887, 890, 894, 900, 1319, 1329, 1366, 1369, 1418, 1423, 1479, 1488, 1514, 1520, 1524, 1542, 1563, 1566, 1805, 1808, 1866, 1869, 1969, 1984, 2042, 2048, 2093, 2096, 2139, 2142, 2142, 2208, 2220, 2276, 2444, 2447, 2448, 2451, 2482, 2486, 2489, 2492, 2500, 2503, 2504, 2507, 2510, 2519, 2519, 2524, 2531, 2534, 2555, 2561, 2570, 2575, 2576, 2579, 2617, 2620, 2626, 2631, 2632, 2635, 2637, 2641, 2641, 2649, 2654, 2662, 2677, 2689, 2745, 2748, 2765, 2768, 2768, 2784, 2787, 2790, 2801, 2817, 2828, 2831, 2832, 2835, 2873, 2876, 2884, 2887, 2888, 2891, 2893, 2902, 2903, 2908, 2915, 2918, 2935, 2946, 2954, 2958, 2965, 2969, 2975, 2979, 2980, 2984, 2986, 2990, 3001, 3006, 3010, 3014, 3021, 3024, 3024, 3031, 3031, 3046, 3066, 3073, 3129, 3133, 3149, 3157, 3161, 3168, 3171, 3174, 3183, 3192, 3199, 3202, 3257, 3260, 3277, 3285, 3286, 3294, 3299, 3302, 3314, 3330, 3386, 3389, 3406, 3415, 3415, 3424, 3427, 3430, 3445, 3449, 3455, 3458, 3478, 3482, 3517, 3520, 3526, 3530, 3530, 3535, 3551, 3570, 3572, 3585, 3642, 3647, 3675, 3713, 3716, 3719, 3722, 3725, 3725, 3732, 3751, 3754, 3773, 3776, 3789, 3792, 3801, 3804, 3807, 3840, 3948, 3953, 4058, 4096, 4295, 4301, 4301, 4304, 4685, 4688, 4701, 4704, 4749, 4752, 4789, 4792, 4805, 4808, 4885, 4888, 4954, 4957, 4988, 4992, 5017, 5024, 5108, 5120, 5788, 5792, 5872, 5888, 5908, 5920, 5942, 5952, 5971, 5984, 6003, 6016, 6109, 6112, 6121, 6128, 6137, 6144, 6157, 6160, 6169, 6176, 6263, 6272, 6314, 6320, 6389, 6400, 6428, 6432, 6443, 6448, 6459, 6464, 6464, 6468, 6509, 6512, 6516, 6528, 6571, 6576, 6601, 6608, 6618, 6622, 6683, 6686, 6780, 6783, 6793, 6800, 6809, 6816, 6829, 6912, 6987, 6992, 7036, 7040, 7155, 7164, 7223, 7227, 7241, 7245, 7295, 7360, 7367, 7376, 7414, 7424, 7654, 7676, 7957, 7960, 7965, 7968, 8005, 8008, 8013, 8016, 8061, 8064, 8147, 8150, 8175, 8178, 8190, 8208, 8231, 8240, 8286, 8304, 8305, 8308, 8348, 8352, 8378, 8400, 8432, 8448, 8585, 8592, 9203, 9216, 9254, 9280, 9290, 9312, 11084, 11088, 11097, 11264, 11507, 11513, 11559, 11565, 11565, 11568, 11623, 11631, 11632, 11647, 11670, 11680, 11835, 11904, 12019, 12032, 12245, 12272, 12283, 12289, 12438, 12441, 12543, 12549, 12589, 12593, 12730, 12736, 12771, 12784, 19893, 19904, 40908, 40960, 42124, 42128, 42182, 42192, 42539, 42560, 42647, 42655, 42743, 42752, 42899, 42912, 42922, 43000, 43051, 43056, 43065, 43072, 43127, 43136, 43204, 43214, 43225, 43232, 43259, 43264, 43347, 43359, 43388, 43392, 43481, 43486, 43487, 43520, 43574, 43584, 43597, 43600, 43609, 43612, 43643, 43648, 43714, 43739, 43766, 43777, 43782, 43785, 43790, 43793, 43798, 43808, 43822, 43968, 44013, 44016, 44025, 44032, 55203, 55216, 55238, 55243, 55291, 63744, 64109, 64112, 64217, 64256, 64262, 64275, 64279, 64285, 64449, 64467, 64831, 64848, 64911, 64914, 64967, 65008, 65021, 65024, 65049, 65056, 65062, 65072, 65131, 65136, 65276, 65281, 65470, 65474, 65479, 65482, 65487, 65490, 65495, 65498, 65500, 65504, 65518, 65532, 65533]);
		isNotPrint16 = new (go$sliceType(Go$Uint16))([173, 907, 909, 930, 1376, 1416, 1424, 1757, 2111, 2209, 2303, 2424, 2432, 2436, 2473, 2481, 2526, 2564, 2601, 2609, 2612, 2615, 2621, 2653, 2692, 2702, 2706, 2729, 2737, 2740, 2758, 2762, 2820, 2857, 2865, 2868, 2910, 2948, 2961, 2971, 2973, 3017, 3076, 3085, 3089, 3113, 3124, 3141, 3145, 3159, 3204, 3213, 3217, 3241, 3252, 3269, 3273, 3295, 3312, 3332, 3341, 3345, 3397, 3401, 3460, 3506, 3516, 3541, 3543, 3715, 3721, 3736, 3744, 3748, 3750, 3756, 3770, 3781, 3783, 3912, 3992, 4029, 4045, 4294, 4681, 4695, 4697, 4745, 4785, 4799, 4801, 4823, 4881, 5760, 5901, 5997, 6001, 6751, 8024, 8026, 8028, 8030, 8117, 8133, 8156, 8181, 8335, 9984, 11311, 11359, 11558, 11687, 11695, 11703, 11711, 11719, 11727, 11735, 11743, 11930, 12352, 12687, 12831, 13055, 42895, 43470, 43815, 64311, 64317, 64319, 64322, 64325, 65107, 65127, 65141, 65511]);
		isPrint32 = new (go$sliceType(Go$Uint32))([65536, 65613, 65616, 65629, 65664, 65786, 65792, 65794, 65799, 65843, 65847, 65930, 65936, 65947, 66000, 66045, 66176, 66204, 66208, 66256, 66304, 66339, 66352, 66378, 66432, 66499, 66504, 66517, 66560, 66717, 66720, 66729, 67584, 67589, 67592, 67640, 67644, 67644, 67647, 67679, 67840, 67867, 67871, 67897, 67903, 67903, 67968, 68023, 68030, 68031, 68096, 68102, 68108, 68147, 68152, 68154, 68159, 68167, 68176, 68184, 68192, 68223, 68352, 68405, 68409, 68437, 68440, 68466, 68472, 68479, 68608, 68680, 69216, 69246, 69632, 69709, 69714, 69743, 69760, 69825, 69840, 69864, 69872, 69881, 69888, 69955, 70016, 70088, 70096, 70105, 71296, 71351, 71360, 71369, 73728, 74606, 74752, 74850, 74864, 74867, 77824, 78894, 92160, 92728, 93952, 94020, 94032, 94078, 94095, 94111, 110592, 110593, 118784, 119029, 119040, 119078, 119081, 119154, 119163, 119261, 119296, 119365, 119552, 119638, 119648, 119665, 119808, 119967, 119970, 119970, 119973, 119974, 119977, 120074, 120077, 120134, 120138, 120485, 120488, 120779, 120782, 120831, 126464, 126500, 126503, 126523, 126530, 126530, 126535, 126548, 126551, 126564, 126567, 126619, 126625, 126651, 126704, 126705, 126976, 127019, 127024, 127123, 127136, 127150, 127153, 127166, 127169, 127199, 127232, 127242, 127248, 127339, 127344, 127386, 127462, 127490, 127504, 127546, 127552, 127560, 127568, 127569, 127744, 127776, 127792, 127868, 127872, 127891, 127904, 127946, 127968, 127984, 128000, 128252, 128256, 128317, 128320, 128323, 128336, 128359, 128507, 128576, 128581, 128591, 128640, 128709, 128768, 128883, 131072, 173782, 173824, 177972, 177984, 178205, 194560, 195101, 917760, 917999]);
		isNotPrint32 = new (go$sliceType(Go$Uint16))([12, 39, 59, 62, 799, 926, 2057, 2102, 2134, 2564, 2580, 2584, 4285, 4405, 54357, 54429, 54445, 54458, 54460, 54468, 54534, 54549, 54557, 54586, 54591, 54597, 54609, 60932, 60960, 60963, 60968, 60979, 60984, 60986, 61000, 61002, 61004, 61008, 61011, 61016, 61018, 61020, 61022, 61024, 61027, 61035, 61043, 61048, 61053, 61055, 61066, 61092, 61098, 61648, 61743, 62262, 62405, 62527, 62529, 62712]);
		shifts = go$toNativeArray("Uint", [0, 0, 1, 0, 2, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0]);
	}
	return go$pkg;
})();
go$packages["main"] = (function() {
	var go$pkg = {}, js = go$packages["github.com/gopherjs/gopherjs/js"], jquery = go$packages["github.com/gopherjs/jquery"], math = go$packages["math"], strconv = go$packages["strconv"], time, TabataTimer, main, NewTabataTimer, jQuery;
	time = go$pkg.time = go$newType(0, "Struct", "main.time", "time", "main", function(minutes_, seconds_) {
		this.go$val = this;
		this.minutes = minutes_ !== undefined ? minutes_ : "";
		this.seconds = seconds_ !== undefined ? seconds_ : "";
	});
	TabataTimer = go$pkg.TabataTimer = go$newType(0, "Struct", "main.TabataTimer", "TabataTimer", "main", function(time_, onSec_, offSec_, roundno_, splash_, endDate_, interval_, rounds_, roundFinished_) {
		this.go$val = this;
		this.time = time_ !== undefined ? time_ : new jquery.JQuery.Ptr();
		this.onSec = onSec_ !== undefined ? onSec_ : new jquery.JQuery.Ptr();
		this.offSec = offSec_ !== undefined ? offSec_ : new jquery.JQuery.Ptr();
		this.roundno = roundno_ !== undefined ? roundno_ : new jquery.JQuery.Ptr();
		this.splash = splash_ !== undefined ? splash_ : new jquery.JQuery.Ptr();
		this.endDate = endDate_ !== undefined ? endDate_ : 0;
		this.interval = interval_ !== undefined ? interval_ : 0;
		this.rounds = rounds_ !== undefined ? rounds_ : 0;
		this.roundFinished = roundFinished_ !== undefined ? roundFinished_ : false;
	});
	main = go$pkg.main = function() {
		var timer;
		timer = NewTabataTimer();
		jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("body")])).On(new (go$sliceType(go$emptyInterface))([new Go$String("keydown"), new (go$funcType([jquery.Event], [], false))((function(e) {
			var _ref;
			_ref = go$parseInt(e.Object.keyCode) >> 0;
			if (_ref === 27) {
				timer.init();
			} else if (_ref === 32 || _ref === 13) {
				timer.start();
			}
		}))]));
		jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#button")])).On(new (go$sliceType(go$emptyInterface))([new Go$String("click"), new (go$funcType([jquery.Event], [], false))((function(e) {
			timer.start();
			e.PreventDefault();
		}))]));
	};
	NewTabataTimer = go$pkg.NewTabataTimer = function() {
		var _struct, time$1, _struct$1, onSec, _struct$2, offSec, _struct$3, roundNo, _struct$4, splash, endDate, interval, rounds, roundFinished, _struct$5, _struct$6, _struct$7, _struct$8, _struct$9;
		time$1 = (_struct = jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("time")])), new jquery.JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		onSec = (_struct$1 = jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#on")])), new jquery.JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
		offSec = (_struct$2 = jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#off")])), new jquery.JQuery.Ptr(_struct$2.o, _struct$2.Jquery, _struct$2.Selector, _struct$2.Length, _struct$2.Context));
		roundNo = (_struct$3 = jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#roundno")])), new jquery.JQuery.Ptr(_struct$3.o, _struct$3.Jquery, _struct$3.Selector, _struct$3.Length, _struct$3.Context));
		splash = (_struct$4 = jQuery(new (go$sliceType(go$emptyInterface))([new Go$String(".splash-container")])), new jquery.JQuery.Ptr(_struct$4.o, _struct$4.Jquery, _struct$4.Selector, _struct$4.Length, _struct$4.Context));
		endDate = 0;
		interval = 0;
		rounds = 0;
		roundFinished = false;
		return new TabataTimer.Ptr((_struct$5 = time$1, new jquery.JQuery.Ptr(_struct$5.o, _struct$5.Jquery, _struct$5.Selector, _struct$5.Length, _struct$5.Context)), (_struct$6 = onSec, new jquery.JQuery.Ptr(_struct$6.o, _struct$6.Jquery, _struct$6.Selector, _struct$6.Length, _struct$6.Context)), (_struct$7 = offSec, new jquery.JQuery.Ptr(_struct$7.o, _struct$7.Jquery, _struct$7.Selector, _struct$7.Length, _struct$7.Context)), (_struct$8 = roundNo, new jquery.JQuery.Ptr(_struct$8.o, _struct$8.Jquery, _struct$8.Selector, _struct$8.Length, _struct$8.Context)), (_struct$9 = splash, new jquery.JQuery.Ptr(_struct$9.o, _struct$9.Jquery, _struct$9.Selector, _struct$9.Length, _struct$9.Context)), endDate, interval, rounds, roundFinished);
	};
	TabataTimer.Ptr.prototype.start = function() {
		var t, err, _tuple, _recv;
		t = this;
		if (!((t.interval === 0))) {
			return;
		}
		err = null;
		_tuple = strconv.Atoi(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#rounds")])).Val()), t.rounds = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			return;
		}
		t.roundno.SetText(new Go$String(t.pad(t.rounds)));
		t.restart();
		t.interval = go$parseInt(go$global.setInterval(go$externalize((_recv = t, function() { return _recv.tick(); }), (go$funcType([], [], false))), 100)) >> 0;
	};
	TabataTimer.prototype.start = function() { return this.go$val.start(); };
	TabataTimer.Ptr.prototype.tick = function() {
		var t, timeDelta, _struct, formattedTime;
		t = this;
		timeDelta = t.endDate - jquery.Now() + 1000;
		if (!t.roundFinished) {
			t.roundno.SetText(new Go$String(t.pad(t.rounds)));
		}
		if (timeDelta > 0) {
			formattedTime = (_struct = t.convertToTime(timeDelta), new time.Ptr(_struct.minutes, _struct.seconds));
			t.time.SetHtml(new Go$String(formattedTime.minutes + ":" + formattedTime.seconds));
		} else {
			if (t.rounds > 0) {
				if (t.roundFinished) {
					t.restart();
				} else {
					t.breakTimer();
					t.rounds = t.rounds - 1 >> 0;
				}
			} else {
				t.roundno.SetText(new Go$String(t.pad(t.rounds)));
				t.interval = go$parseInt(go$global.clearTimeout(t.interval)) >> 0;
			}
		}
	};
	TabataTimer.prototype.tick = function() { return this.go$val.tick(); };
	TabataTimer.Ptr.prototype.pad = function(n) {
		var t;
		t = this;
		if (n > 9) {
			return strconv.Itoa(n);
		}
		return "0" + strconv.Itoa(n);
	};
	TabataTimer.prototype.pad = function(n) { return this.go$val.pad(n); };
	TabataTimer.Ptr.prototype.convertToTime = function(milliseconds) {
		var t, tmsec, minutes, seconds;
		t = this;
		tmsec = math.Floor(milliseconds / 1000);
		minutes = math.Floor(tmsec / 60);
		seconds = tmsec - (minutes * 60);
		return new time.Ptr(t.pad((minutes >> 0)), t.pad((seconds >> 0)));
	};
	TabataTimer.prototype.convertToTime = function(milliseconds) { return this.go$val.convertToTime(milliseconds); };
	TabataTimer.Ptr.prototype.breakTimer = function() {
		var t, _tuple, offSeconds, err;
		t = this;
		_tuple = strconv.Atoi(t.offSec.Val()), offSeconds = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			return;
		}
		t.endDate = jquery.Now() + offSeconds * 1000;
		t.roundFinished = true;
		t.splash.SetCss(new (go$sliceType(go$emptyInterface))([new Go$String("background-color"), new Go$String("#1f8dd6")]));
	};
	TabataTimer.prototype.breakTimer = function() { return this.go$val.breakTimer(); };
	TabataTimer.Ptr.prototype.restart = function() {
		var t, _tuple, onSeconds, err;
		t = this;
		_tuple = strconv.Atoi(t.onSec.Val()), onSeconds = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			return;
		}
		t.endDate = jquery.Now() + onSeconds * 1000;
		t.roundFinished = false;
		t.splash.SetCss(new (go$sliceType(go$emptyInterface))([new Go$String("background-color"), new Go$String("#f57b00")]));
	};
	TabataTimer.prototype.restart = function() { return this.go$val.restart(); };
	TabataTimer.Ptr.prototype.init = function() {
		var t;
		t = this;
		t.interval = go$parseInt(go$global.clearTimeout(t.interval)) >> 0;
		t.roundno.SetText(new Go$String("00"));
		t.time.SetHtml(new Go$String("00:00"));
		t.splash.SetCss(new (go$sliceType(go$emptyInterface))([new Go$String("background-color"), new Go$String("#1f8dd6")]));
	};
	TabataTimer.prototype.init = function() { return this.go$val.init(); };
	go$pkg.init = function() {
		time.init([["minutes", "minutes", "main", Go$String, ""], ["seconds", "seconds", "main", Go$String, ""]]);
		(go$ptrType(TabataTimer)).methods = [["breakTimer", "main", [], [], false, -1], ["convertToTime", "main", [Go$Float64], [time], false, -1], ["init", "main", [], [], false, -1], ["pad", "main", [Go$Int], [Go$String], false, -1], ["restart", "main", [], [], false, -1], ["start", "main", [], [], false, -1], ["tick", "main", [], [], false, -1]];
		TabataTimer.init([["time", "time", "main", jquery.JQuery, ""], ["onSec", "onSec", "main", jquery.JQuery, ""], ["offSec", "offSec", "main", jquery.JQuery, ""], ["roundno", "roundno", "main", jquery.JQuery, ""], ["splash", "splash", "main", jquery.JQuery, ""], ["endDate", "endDate", "main", Go$Float64, ""], ["interval", "interval", "main", Go$Int, ""], ["rounds", "rounds", "main", Go$Int, ""], ["roundFinished", "roundFinished", "main", Go$Bool, ""]]);
		jQuery = jquery.NewJQuery;
	}
	return go$pkg;
})();
go$error.implementedBy = [go$packages["errors"].errorString.Ptr, go$packages["github.com/gopherjs/gopherjs/js"].Error.Ptr, go$packages["runtime"].TypeAssertionError.Ptr, go$packages["runtime"].errorString, go$packages["strconv"].NumError.Ptr, go$ptrType(go$packages["runtime"].errorString)];
go$packages["github.com/gopherjs/gopherjs/js"].Object.implementedBy = [go$packages["github.com/gopherjs/gopherjs/js"].Error, go$packages["github.com/gopherjs/gopherjs/js"].Error.Ptr, go$packages["github.com/gopherjs/jquery"].Event, go$packages["github.com/gopherjs/jquery"].Event.Ptr];
go$packages["runtime"].init();
go$packages["github.com/gopherjs/gopherjs/js"].init();
go$packages["github.com/gopherjs/jquery"].init();
go$packages["math"].init();
go$packages["errors"].init();
go$packages["unicode/utf8"].init();
go$packages["strconv"].init();
go$packages["main"].init();
go$packages["main"].main();

})();