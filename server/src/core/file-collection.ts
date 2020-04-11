import { gql } from 'apollo-server-core';
import * as fs from 'fs';
import * as path from 'path';
import { AllowNull, BelongsTo, Column, DataType, ForeignKey, PrimaryKey, Table } from 'sequelize-typescript';
import { v4 as UUIDv4 } from 'uuid';
import { BaseModel } from '../main/base-model';
import { ModelRoot } from '../main/model-root';
import { Resolvers } from '../main/resolver-types';
import { FileContent } from './file-content';

export const fileCollectionSchema = gql`
    type FileCollectionElement {
        path: String!
        content: FileContent!
    }

    type FileCollection {
        uuid: String!
        files: [FileCollectionElement!]!
    }
`;

/**
 * A collection of files, identified by a UUID.
 *
 * NOTE: a collection is immutable, when is created files cannot be added/removed.
 */
@Table({ timestamps: false, tableName: 'file_collection' })
export class FileCollection extends BaseModel<FileCollection> {
    @PrimaryKey
    @Column(DataType.UUIDV4)
    uuid!: string;

    @AllowNull(false)
    @ForeignKey(() => FileContent)
    @Column
    contentId!: string;

    /** Path of this file in the contest, e.g. home.md */
    @PrimaryKey
    @Column
    path!: string;

    @BelongsTo(() => FileContent)
    content!: FileContent;
    getContent!: () => Promise<FileContent>;
}

/**
 * Create a new FileCollection from a directory
 *
 * @param root ModelRoot to use to create the collection
 * @param directory directory that is the root of the collection
 * @return UUID of the created collection
 */
export const createFileCollection = async (root: ModelRoot, directory: string) => {
    const uuid = UUIDv4();

    console.debug(`CREATING FileCollection uuid = ${uuid}, directory = ${directory}`);

    const addFiles = async (dir: string) => {
        const files = fs.readdirSync(path.join(directory, dir));
        for (const file of files) {
            const relPath = path.join(dir, file);
            if (fs.statSync(path.join(directory, relPath)).isDirectory()) {
                console.debug(`ADD DIRECTORY ${relPath}`);
                await addFiles(relPath);
            } else {
                console.debug(`ADD FILE ${relPath}`);
                const content = await FileContent.createFromPath(root, path.join(directory, relPath));
                await root.table(FileCollection).create({
                    uuid,
                    contentId: content.id,
                    path: relPath,
                });
            }
        }
    };

    await addFiles('');

    return uuid;
};

/**
 * Extracts a file collection in a temporary directory.
 * If the collection is already in cache, do nothing.
 *
 * @param uuid UUID of the collection
 */
export const extractFileCollection = async (model: ModelRoot, uuid: string) => {
    const tempDir = path.join(model.config.cachePath, uuid);

    try {
        if ((await fs.promises.stat(tempDir)).isDirectory()) {
            console.debug(`EXTRACT FILE COLLECTION uuid = ${uuid} RESOLVED BY CACHE`);

            return tempDir;
        }
    } catch {
        // Directory doesn't exist and thus stat fails
    }

    console.debug(`EXTRACT FILE COLLECTION uuid = ${uuid} INTO ${tempDir}`);

    const collection = await model.table(FileCollection).findAll({ where: { uuid } });

    for (const file of collection) {
        const filePath = path.join(tempDir, file.path);

        console.debug(`EXTRACT FILE hash = ${file.contentId} IN ${filePath}`);

        const content = await model.table(FileContent).findOne({ where: { id: file.contentId } });
        await content?.extract(filePath);
    }

    return tempDir;
};

export interface FileCollectionModelRecord {
    FileCollection: {
        uuid: string;
    };
    FileCollectionElement: FileCollection;
}

export const fileCollectionResolvers: Resolvers = {
    FileCollection: {
        uuid: f => f.uuid,
        files: ({ uuid }, _, ctx) => ctx.root.table(FileCollection).findAll({ where: { uuid } }),
    },
    FileCollectionElement: {
        path: f => f.path,
        content: (collection, _, ctx) => ctx.root.table(FileContent).findOne({ where: { id: collection.contentId } }),
    },
};
