import { PrologEngineAdapter } from "./PrologEngineAdapter.js";

/**
 * TauPrologAdapter
 * ----------------------------
 * Implementation using Tau Prolog (Pure JS).
 * Compatible with Node.js, Deno/Edge, and Browser.
 */
export class TauPrologAdapter extends PrologEngineAdapter {
  constructor(pl) {
    super();
    if (!pl) {
      throw new Error("Tau Prolog instance (pl) is required for TauPrologAdapter");
    }
    this.session = pl.create();
  }

  async consult(facts) {
    const program = Array.isArray(facts) ? facts.join("\n") : facts;
    // On force le mode double_quotes: atom pour simplifier la récupération des chaînes
    const fullProgram = ":- set_prolog_flag(double_quotes, atom).\n" + program;
    return new Promise((resolve, reject) => {
      this.session.consult(fullProgram, {
        success: () => resolve(),
        error: (err) => reject(new Error(this.session.format_answer(err))),
      });
    });
  }

  async query(goal) {
    return new Promise((resolve, reject) => {
      this.session.query(goal, {
        success: () => resolve(),
        error: (err) => reject(new Error(this.session.format_answer(err))),
      });
    });
  }

  answers(callback) {
    if (this._aborted) return;

    this.session.answer({
      success: (answer) => {
        if (answer) {
          const result = {};
          Object.keys(answer.links).forEach((key) => {
            const val = answer.links[key];
            // Avec double_quotes=atom, les chaînes sont des atomes
            result[key] = val.toString().replace(/^'|'$/g, "");
          });

          callback(result);
          // Keep looking for more answers
          this.answers(callback);
        }
      },
      error: (err) => {
        console.error("Prolog Error:", this.session.format_answer(err));
      },
      fail: () => {
        // No more answers
      },
    });
  }

  abortQuery() {
    // Tau Prolog doesn't have a direct abort for async answers,
    // but we can stop calling fetchNext.
    this._aborted = true;
  }
}
