import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { auth } from "@/auth";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

// PrismaPg (pg library) ignores Prisma's ?schema= param — convert to native search_path
const rawUrl = process.env.DATABASE_URL ?? "";
const connectionString = rawUrl.replace(
  /[?&]schema=([^&]+)/,
  (_, schema) => `?options=-csearch_path%3D${schema}`
);
const adapter = new PrismaPg({ connectionString });

const basePrisma =
  globalForPrisma.prisma ||
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = basePrisma;

const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async create({ model, operation, args, query }) {
        try {
          const session = await auth();
          const userId = session?.user?.id ? parseInt(session.user.id, 10) : undefined;
          
          if (userId && args.data) {
            const fields = Prisma.dmmf.datamodel.models.find(m => m.name === model)?.fields;
            if (fields) {
              const hasCreatedBy = fields.some(f => f.name === 'createdBy');
              const hasCreated_by = fields.some(f => f.name === 'created_by');
              const hasUpdatedBy = fields.some(f => f.name === 'updatedBy');
              const hasUpdated_by = fields.some(f => f.name === 'updated_by');
              
              const data = args.data as Record<string, any>;
              if (hasCreatedBy && data.createdBy === undefined) data.createdBy = userId;
              if (hasCreated_by && data.created_by === undefined) data.created_by = userId;
              if (hasUpdatedBy && data.updatedBy === undefined) data.updatedBy = userId;
              if (hasUpdated_by && data.updated_by === undefined) data.updated_by = userId;
            }
          }
        } catch (e) {
          // Ignore auth errors in non-request contexts
        }
        return query(args);
      },
      async update({ model, operation, args, query }) {
        try {
          const session = await auth();
          const userId = session?.user?.id ? parseInt(session.user.id, 10) : undefined;
          
          if (userId && args.data) {
            const fields = Prisma.dmmf.datamodel.models.find(m => m.name === model)?.fields;
            if (fields) {
              const hasUpdatedBy = fields.some(f => f.name === 'updatedBy');
              const hasUpdated_by = fields.some(f => f.name === 'updated_by');
              
              const data = args.data as Record<string, any>;
              if (hasUpdatedBy && data.updatedBy === undefined) data.updatedBy = userId;
              if (hasUpdated_by && data.updated_by === undefined) data.updated_by = userId;
            }
          }
        } catch (e) {
          // Ignore auth errors
        }
        return query(args);
      },
      async upsert({ model, operation, args, query }) {
        try {
          const session = await auth();
          const userId = session?.user?.id ? parseInt(session.user.id, 10) : undefined;
          
          if (userId) {
            const fields = Prisma.dmmf.datamodel.models.find(m => m.name === model)?.fields;
            if (fields) {
              const hasCreatedBy = fields.some(f => f.name === 'createdBy');
              const hasCreated_by = fields.some(f => f.name === 'created_by');
              const hasUpdatedBy = fields.some(f => f.name === 'updatedBy');
              const hasUpdated_by = fields.some(f => f.name === 'updated_by');
              
              if (args.create) {
                const createData = args.create as Record<string, any>;
                if (hasCreatedBy && createData.createdBy === undefined) createData.createdBy = userId;
                if (hasCreated_by && createData.created_by === undefined) createData.created_by = userId;
                if (hasUpdatedBy && createData.updatedBy === undefined) createData.updatedBy = userId;
                if (hasUpdated_by && createData.updated_by === undefined) createData.updated_by = userId;
              }
              if (args.update) {
                const updateData = args.update as Record<string, any>;
                if (hasUpdatedBy && updateData.updatedBy === undefined) updateData.updatedBy = userId;
                if (hasUpdated_by && updateData.updated_by === undefined) updateData.updated_by = userId;
              }
            }
          }
        } catch (e) {
          // Ignore auth errors
        }
        return query(args);
      }
    }
  }
});

export default prisma;
