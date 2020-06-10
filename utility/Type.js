/**
 * @license
 * Copyright (c) 2019 LightWayUp
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

"use strict";

// t relies on:
// unwrap
function t(object, type) {

    type = unwrap(type);
    if (!["string", "function"].some(validType => typeof type === validType)) {
        throw new TypeError("Incorrect type for t arguments!");
    }

    // t(null, "null")
    if (object === null) {
        return type === "null";
    }

    // t(true, "boolean")
    if (typeof type === "string") {
        return typeof object === type;
    }

    // class A {}
    // class B extends A {}
    // t(new B(), A)
    return object instanceof type;
}

function wrap(value) {
    return ["boolean", "number", "string", "symbol", "bigint"]
        .some(type => typeof value === type) ? Object(value) : value;
}

function unwrap(object) {
    return [Boolean, Number, String, Symbol, BigInt]
        .some(wrapper => object instanceof wrapper) ? object.valueOf() : object;
}

function undefinedIfNull(any) {
    return any == null ? undefined : any;
}

function nullIfUndefined(any) {
    return any == null ? null : any;
}

const Type = {
    t,
    wrap,
    unwrap,
    undefinedIfNull,
    nullIfUndefined
};

export default Type;
