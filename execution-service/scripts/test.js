const { executeCode } = require("../runner/executeCode");

(async () => {
  const result = await executeCode({
    code: `console.log("Hello World");`,
    input: "",
  });

  console.log(result);
})();