class StringSchema {
  min() { return this; }
  default(value) { this.defaultValue = value; return this; }
  volatile() { this.isVolatile = true; return this; }
}

export default {
  object(fields) { return { fields }; },
  string() { return new StringSchema(); },
};
