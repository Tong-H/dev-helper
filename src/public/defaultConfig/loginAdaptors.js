module.exports = [{
	pattern: /example\.com/,
	adaptor: async (account) => {
		// simulates real user typing
		const inputting = (dom, text) => {
			if (!dom || !text) return;
			const simulateKeyEvent = (type, key) =>
				dom.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));

			for (const char of text) {
				simulateKeyEvent('keydown', char);
				simulateKeyEvent('keypress', char);
				dom.value += char;
				dom.dispatchEvent(new Event('input', { bubbles: true }));
				dom.dispatchEvent(new Event('change', { bubbles: true }));
				simulateKeyEvent('keyup', char);
			}
		}
		inputting(document.querySelector('#login-username'), account.user)
		inputting(document.querySelector('#login-password'), account.pwd)
		await new Promise(resolve => setTimeout(resolve, 500));
		document.querySelector('#btn-login')?.click()
		return "success" // return success to indicate login success
	},

}
];
