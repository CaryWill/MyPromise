const State = {
  PENDING: 0,
  FULFILLED: 1,
  REJECTED: 2,
};

function MyPromise(executor) {
  this.state = State.PENDING;
  this.value = null;
  this.reason = null;
  this.onFulfilledCallbacks = [];
  this.onRejectedCallbacks = [];

  const resolve = (val = "") => {
    if (this.state !== State.PENDING) return;

    this.state = State.FULFILLED;
    this.value = val;

    this.onFulfilledCallbacks.forEach((callback) => {
      // 微任务(不过此处实现的方式是宏任务)
      setTimeout(() => {
        // 因为 then(res => callback(res)) 所以 callback 的参数是 this.value
        // 而且每次执行 callback 会改变 this.value 这样可以将上一个 callback 的值传递给下一个
        callback(this.value);
      }, 0);
    });
  };

  const reject = (reason = "") => {
    if (this.state !== State.PENDING) return;

    this.state = State.REJECTED;
    this.reason = reason;

    this.onRejectedCallbacks.forEach((callback) => {
      // 微任务(不过此处实现的方式是宏任务)
      setTimeout(() => {
        callback(this.reason);
      }, 0);
    });
  };

  // executor 入参乱写导致报错
  try {
    executor(resolve, reject);
  } catch (error) {
    reject(error);
  }
}

function resolvePromise(promise, x, resolve, reject) {
  // FIXME:规范上这么说，但是什么场景下会相同呢
  if (promise === x) {
    return reject(new TypeError("promise and value refer to the same object."));
  }

  if (x instanceof MyPromise) {
    x.then(
      (res) => {
        if (res instanceof MyPromise) {
          resolvePromise(promise, res, resolve, reject);
        } else {
          resolve(res);
        }
      },
      (error) => {
        if (error instanceof MyPromise) {
          resolvePromise(promise, error, resolve, reject);
        } else {
          reject(error);
        }
      }
    );
  } else if (["object", "function"].includes(typeof x)) {
    // 如果是 thenable 的话
    try {
      if (typeof x.then === "function") {
        x.then.call(
          x,
          (y) => resolvePromise(promise, y, resolve, reject),
          (r) => reject(r)
        );
        // TODO: If both resolvePromise and rejectPromise are called 这种情况有可能是 x.then 本身的实现有问题，比如我的 x 长这样 { then((res, rej) => {res();rej();})} 也不是不行啊
      } else {
        resolve(x);
      }
    } catch (error) {
      reject(error);
    }
  } else {
    resolve(x);
  }
}

MyPromise.prototype.then = function then(
  onFulfilled = (v) => v,
  onRejected = (v) => v
) {
  if (this.state === State.FULFILLED) {
    const promise = new MyPromise((resolve, reject) => {
      // 因为 fulfilled 了，所以直接加入到微任务中即可
      setTimeout(() => {
        try {
          const _value = onFulfilled(this.value);
          if (_value instanceof MyPromise) {
            resolvePromise(promise, _value, resolve, reject);
          } else {
            resolve(_value);
          }
        } catch (error) {
          reject(error);
        }
      }, 0);
    });
    return promise;
  }

  if (this.state === State.REJECTED) {
    const promise = new MyPromise((resolve, reject) => {
      // 因为 rejected 了，所以直接加入到微任务中即可
      setTimeout(() => {
        try {
          const _value = onRejected(this.reason);
          if (_value instanceof MyPromise) {
            resolvePromise(promise, _value, resolve, reject);
          } else {
            reject(_value);
          }
        } catch (error) {
          reject(error);
        }
      }, 0);
    });
    return promise;
  }

  if (this.state === State.PENDING) {
    const promise = new MyPromise((resolve, reject) => {
      // 包一层然后加入到 callback list 中等待 this 被 settle
      // 包一层是因为有可能 onFulfilled() 返回 promise
      this.onFulfilledCallbacks.push((value) => {
        try {
          const _value = onFulfilled(value);
          if (_value instanceof MyPromise) {
            resolvePromise(promise, _value, resolve, reject);
          } else {
            resolve(_value);
          }
        } catch (error) {
          reject(error);
        }
      });

      this.onRejectedCallbacks.push((reason) => {
        try {
          const _value = onFulfilled(reason);
          if (_value instanceof MyPromise) {
            resolvePromise(promise, _value, resolve, reject);
          } else {
            resolve(_value);
          }
        } catch (error) {
          reject(error);
        }
      });
    });
    // 直接返回以便 promise chaining
    return promise;
  }
};

MyPromise.deferred = function () {
  var result = {};
  result.promise = new MyPromise(function (resolve, reject) {
    result.resolve = resolve;
    result.reject = reject;
  });

  return result;
};

MyPromise.resolve = (value) => new MyPromise((resolve, _) => resolve(value));
MyPromise.reject = (reason) => new MyPromise((_, reject) => reject(reason));

module.exports = MyPromise;
