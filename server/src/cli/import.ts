import * as fs from 'fs';
import * as mime from 'mime-types';
import * as path from 'path';
import * as yaml from 'yaml';
import { ApiContext } from '../api/index';
import { UserRole } from '../model/user';

/**
 * Import a contest in the database
 *
 * @param ctx the API context
 * @param dir base directoyr of the contest
 */
export async function importContest(ctx: ApiContext, dir = process.cwd()) {
    const turingarenaYAMLPath = path.join(dir, 'turingarena.yaml');

    if (!fs.existsSync(turingarenaYAMLPath))
        throw Error('Invalid contest directory');

    const turingarenaYAML = fs.readFileSync(turingarenaYAMLPath).toString();
    const metadata = yaml.parse(turingarenaYAML);

    const contest = await ctx.db.Contest.create(metadata);

    await contest.addFiles(ctx, path.join(dir, 'files'));

    for (const user of metadata.users) {
        await contest.createParticipation({
            user: {
                ...user,
                role:
                    user.role === 'admin'
                        ? UserRole.ADMIN
                        : UserRole.USER,
            },
        }, {
            include: [ctx.db.User],
        });
    }

    for (const name of metadata.problems) {
        const problem = await ctx.db.Problem.create({
            name,
        });

        await problem.addFiles(ctx, path.join(dir, name));
        await ctx.db.ContestProblem.create({
            contestId: contest.id,
            problemId: problem.id,
        });

        console.log((await problem.metadata(ctx)));
    }
}
