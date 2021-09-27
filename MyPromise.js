const State = {
  PENDING: 0,
  FULFILLED: 1,
  REJECTED: 2
}

function MyPromise(executor) {
  this.state = State.PENDING;
  this.value = null;
  this.reason = null;
  this.onFulfilledCallbacks = [];
  this.onRejectedCallbacks = [];

  const resolve = (val) => {
    this.state = State.FULFILLED;
    this.value = val;

    this.onFulfilledCallbacks.forEach(callback => {
      // 微任务(不过此处实现的方式是宏任务)
      setTimeout(() => {
        // 因为 then(res => callback(res)) 所以 callback 的参数是 this.value
        // 而且每次执行 callback 会改变 this.value 这样可以将上一个 callback 的值传递给下一个
        callback(this.value);
      }, 0);
    })
  }

  const reject = (reason) => {
    this.state = State.FULFILLED;
    this.reason = reason;

    this.onRejectedCallbacks.forEach(callback => {
      // 微任务(不过此处实现的方式是宏任务)
      setTimeout(() => {
        callback(this.reason);
      }, 0);
    })
  }

  // executor 入参乱写导致报错
  try {
    executor(resolve, reject)
  } catch (error) {
    reject(error);
  }
}

function resolvePromise(value, resolve, reject) {
  if (value instanceof MyPromise(executor)) {
    value.then(res => {
      if (res instanceof MyPromise) {
        resolvePromise(res, resolve, reject);
      } else {
        resolve(res);
      }
    }, error => {
      if (error instanceof MyPromise) {
        resolvePromise(res, resolve, reject);
      } else {
        reject(error);
      }
    })
  } else if (value.then) {
    // 如果是 thenable 的话做类似处理
    // TODO:
  } else {
    resolve(value);
  }
}

MyPromise.prototype.then = function then(onFulfilled, onRejected) {
  if (this.state === State.PENDING) {
    const promise = new MyPromise((resolve, reject) => {
      // 包一层然后加入到 callback list 中等待 this 被 settle
      // 包一层是因为有可能 onFulfilled() 返回 promise
      this.onFulfilledCallbacks.push((value) => {
        const _value = onFulfilled(value);
        if (_value instanceof MyPromise) {
          resolvePromise(_value, resolve, reject);
        } else {
          resolve(_value);
        }
      })

      this.onRejectedCallbacks.push((reason) => {
        const _value = onFulfilled(reason);
        if (_value instanceof MyPromise) {
          resolvePromise(_value, resolve, reject);
        } else {
          resolve(_value);
        }
      })
    })
    // 直接返回以便 promise chaining
    return promise;
  }

  if (this.state === State.FULFILLED) {
    const promise = new MyPromise((resolve, reject) => {
      // 因为 fulfilled 了，所以直接加入到微任务中即可
      setTimeout(() => {
        const _value = onFulfilled(value);
        if (_value instanceof MyPromise) {
          resolvePromise(_value, resolve, reject);
        } else {
          resolve(_value);
        }
      }, 0)
    })
    return promise;
  }

  if (this.state === State.REJECTED) {
    const promise = new MyPromise((resolve, reject) => {
      // 因为 fulfilled 了，所以直接加入到微任务中即可
      setTimeout(() => {
        const _value = onRejected(value);
        if (_value instanceof MyPromise) {
          resolvePromise(_value, resolve, reject);
        } else {
          resolve(_value);
        }
      }, 0)
    })
    return promise;
  }
}

MyPromise.deferred = function () {
  var result = {};
  result.promise = new MyPromise(function (resolve, reject) {
    result.resolve = resolve;
    result.reject = reject;
  });

  return result;
}

module.exports = MyPromise;