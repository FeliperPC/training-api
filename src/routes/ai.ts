import { FastifyInstance } from "fastify";

export const aiRoutes = async (app: FastifyInstance) => {
  app.post("/ai", async function (request, reply) {
    return reply.status(200).send({
      message: "Hello World",
    });
  });
};
